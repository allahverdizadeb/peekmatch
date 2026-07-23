import { Router } from 'express';
import { prisma } from '../../db.js';
import { parseRangeOrRespond } from '../../lib/adminRoute.js';
import { distinctVisitorCount, buildMetric } from '../../lib/adminMetrics.js';
import { formatCount, formatPercent, computeDelta } from '../../lib/kpi.js';
import { enumerateBuckets, formatBakuDateTime, type ResolvedRange } from '../../lib/dateRange.js';

export const trafficRouter = Router();

type Acquisition = 'direct' | 'organic_search' | 'paid_social' | 'organic_social' | 'referral' | 'campaign' | 'unknown';

const SEARCH_ENGINES = ['google.', 'bing.', 'yandex.', 'duckduckgo.'];
const SOCIAL_DOMAINS = ['facebook.', 'instagram.', 'linkedin.', 'twitter.', 'x.com', 'tiktok.'];

function categorize(referrerDomain: string | null, utmSource: string | null, utmMedium: string | null): Acquisition {
  if (utmSource) {
    if (utmMedium && /social/i.test(utmMedium)) return 'paid_social';
    return 'campaign';
  }
  if (!referrerDomain) return 'direct';
  if (SEARCH_ENGINES.some((d) => referrerDomain.includes(d))) return 'organic_search';
  if (SOCIAL_DOMAINS.some((d) => referrerDomain.includes(d))) return 'organic_social';
  return 'referral';
}

async function distinctSessionCount(range: ResolvedRange): Promise<number> {
  const rows = await prisma.event.findMany({
    where: { createdAt: { gte: range.startUtc, lt: range.endUtc }, webSessionRef: { not: null } },
    distinct: ['webSessionRef'],
    select: { webSessionRef: true },
  });
  return rows.length;
}

async function newVisitorPct(range: ResolvedRange): Promise<number | null> {
  const inRange = await prisma.event.findMany({
    where: { createdAt: { gte: range.startUtc, lt: range.endUtc }, visitorRef: { not: null } },
    distinct: ['visitorRef'],
    select: { visitorRef: true },
  });
  if (inRange.length === 0) return null;
  const refs = inRange.map((r) => r.visitorRef as string);
  const returning = await prisma.event.findMany({
    where: { visitorRef: { in: refs }, createdAt: { lt: range.startUtc } },
    distinct: ['visitorRef'],
    select: { visitorRef: true },
  });
  const returningSet = new Set(returning.map((r) => r.visitorRef));
  const newCount = refs.filter((r) => !returningSet.has(r)).length;
  return (newCount / refs.length) * 100;
}

trafficRouter.get('/', async (req, res) => {
  const parsed = parseRangeOrRespond(req, res);
  if (!parsed) return;
  const { range, comparison } = parsed;

  const [visitors, sessions, newPct, newPctPrev] = await Promise.all([
    buildMetric(distinctVisitorCount, range, comparison, formatCount, 'higher_is_better'),
    buildMetric(distinctSessionCount, range, comparison, formatCount, 'higher_is_better'),
    newVisitorPct(range),
    comparison ? newVisitorPct(comparison) : Promise.resolve(null),
  ]);

  const visitorTrend: { bucket: string; value: number }[] = [];
  for (const bucketStart of enumerateBuckets(range)) {
    const stepMs = range.granularity === 'hour' ? 3_600_000 : 86_400_000;
    const bucketRange: ResolvedRange = { startUtc: bucketStart, endUtc: new Date(bucketStart.getTime() + stepMs), granularity: range.granularity };
    visitorTrend.push({ bucket: formatBakuDateTime(bucketStart), value: await distinctVisitorCount(bucketRange) });
  }

  const pageViews = await prisma.event.findMany({
    where: { name: 'page_viewed', createdAt: { gte: range.startUtc, lt: range.endUtc } },
    select: { path: true, referrerDomain: true, utmSource: true, utmMedium: true, utmCampaign: true, deviceCategory: true, language: true },
  });

  const acquisitionCounts = new Map<Acquisition, number>();
  const referrerCounts = new Map<string, number>();
  const landingPathCounts = new Map<string, number>();
  const deviceCounts = new Map<string, number>();
  const languageCounts = new Map<string, number>();
  const utmSourceCounts = new Map<string, number>();

  for (const pv of pageViews) {
    const cat = categorize(pv.referrerDomain, pv.utmSource, pv.utmMedium);
    acquisitionCounts.set(cat, (acquisitionCounts.get(cat) ?? 0) + 1);
    if (pv.referrerDomain) referrerCounts.set(pv.referrerDomain, (referrerCounts.get(pv.referrerDomain) ?? 0) + 1);
    if (pv.path) landingPathCounts.set(pv.path, (landingPathCounts.get(pv.path) ?? 0) + 1);
    if (pv.deviceCategory) deviceCounts.set(pv.deviceCategory, (deviceCounts.get(pv.deviceCategory) ?? 0) + 1);
    if (pv.language) languageCounts.set(pv.language, (languageCounts.get(pv.language) ?? 0) + 1);
    if (pv.utmSource) utmSourceCounts.set(pv.utmSource, (utmSourceCounts.get(pv.utmSource) ?? 0) + 1);
  }

  const toRows = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count }));

  res.json({
    range: { startUtc: range.startUtc, endUtc: range.endUtc, granularity: range.granularity },
    comparison: comparison ? { startUtc: comparison.startUtc, endUtc: comparison.endUtc } : null,
    kpis: {
      uniqueVisitors: visitors,
      sessions,
      avgSessionDuration: { value: null, formatted: '—', missing: true, trackingStatus: 'İnstrumentasiya tələb olunur' },
      newVisitorPct: {
        value: newPct,
        formatted: newPct === null ? '—' : formatPercent(newPct),
        missing: newPct === null,
        delta: newPct !== null ? computeDelta(newPct, newPctPrev, 'neutral') : null,
      },
    },
    visitorTrend,
    acquisition: toRows(new Map([...acquisitionCounts.entries()].map(([k, v]) => [k, v]))),
    landingPages: toRows(landingPathCounts).slice(0, 10),
    referrerDomains: toRows(referrerCounts).slice(0, 10),
    device: toRows(deviceCounts),
    language: toRows(languageCounts),
    utmSource: toRows(utmSourceCounts),
    browser: { missing: true, trackingStatus: 'İnstrumentasiya tələb olunur' },
    operatingSystem: { missing: true, trackingStatus: 'İnstrumentasiya tələb olunur' },
    region: { missing: true, trackingStatus: 'İnstrumentasiya tələb olunur' },
  });
});
