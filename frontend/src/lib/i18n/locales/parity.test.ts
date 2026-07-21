import { describe, it, expect } from 'vitest';
import { LOCALES, type Lang } from './index';

/** Recursively flattens a locale dict into { "a.b.c": value } pairs, including array indices, so
 * every leaf string in the (deeply nested) Dict tree gets its own comparable path. */
function flatten(obj: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof obj === 'string') {
    out[prefix] = obj;
  } else if (Array.isArray(obj)) {
    obj.forEach((item, i) => Object.assign(out, flatten(item, `${prefix}[${i}]`)));
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) Object.assign(out, flatten(v, prefix ? `${prefix}.${k}` : k));
  }
  return out;
}

const LANGS = Object.keys(LOCALES) as Lang[];
const NON_AZ_LANGS = LANGS.filter((l) => l !== 'az');
const flattened: Record<Lang, Record<string, string>> = Object.fromEntries(
  LANGS.map((l) => [l, flatten(LOCALES[l])]),
) as Record<Lang, Record<string, string>>;

describe('i18n locale structural parity', () => {
  it.each(NON_AZ_LANGS)('%s has exactly the same set of leaf keys as az (the structural source of truth)', (lang) => {
    const azKeys = new Set(Object.keys(flattened.az));
    const keys = new Set(Object.keys(flattened[lang]));
    const missing = [...azKeys].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !azKeys.has(k));
    expect(missing, `${lang} is missing keys present in az`).toEqual([]);
    expect(extra, `${lang} has keys not present in az`).toEqual([]);
  });

  // Keys where an empty string is intentional: the sentence's connector word lives entirely in
  // subtitlePrefix for these languages, so nothing needs to follow the dynamic vacancy title.
  // See Results.tsx: `{subtitlePrefix} {vacancyTitle} {subtitleSuffix}`.
  const INTENTIONALLY_EMPTY = new Set(['results.subtitleSuffix']);

  it.each(LANGS)('%s has no unintentional empty-string values', (lang) => {
    const empties = Object.entries(flattened[lang])
      .filter(([k, v]) => v.trim() === '' && !INTENTIONALLY_EMPTY.has(k))
      .map(([k]) => k);
    expect(empties, `${lang} has empty string values at these keys`).toEqual([]);
  });
});

// Keys whose value is legitimately identical across languages — sample/placeholder data (job
// titles, company names, filenames, URLs used purely as UI mockup content on the landing page),
// or common English loanwords used as-is in Azerbaijani tech/business terminology. Each entry is
// a conscious decision, not a blanket exemption — if a real UI string ends up here, that's a bug.
const SAME_VALUE_OK_KEYS = new Set([
  // Landing page hero/how-it-works mockups: intentionally show an English-language sample CV and
  // job posting as UI decoration, regardless of site language — matches the approved design.
  'landing.cvCardName',
  'landing.cvCardTag1',
  'landing.heroVacancyTitle',
  'landing.heroVacancyCompany',
  'landing.vacancyItem1',
  'landing.vacancyItem2',
  'landing.vacancyItem3',
  'landing.vacancyItem4',
  'landing.howVisualFileName',
  'landing.howVisualFileHint',
  'landing.howVisualUrl',
  'landing.howVisualVacancyTitle',
  'landing.exampleJobTitle',
  // Generic placeholder/format strings with no language-specific content.
  'analysisForm.vacancyUrlPlaceholder',
  // Established English loanwords used as-is in Azerbaijani professional/tech vocabulary.
  'analysisForm.minCharsPrefix',
  'analysisForm.languagePills.en',
  'paymentStatus.statusLabel',
  'workspace.tableStatus',
  'workspace.problem',
  'workspace.tellMeAboutYourselfTitle',
  // The language switcher must show each language's own native name/endonym in every locale —
  // "Azərbaycan dili" is not translated when viewed from en, by definition.
  'languageSwitcher.az',
  'languageSwitcher.en',
  // Brand name, never translated in any locale.
  'landing.peekmatchLabel',
  'results.newAnalysisCta',
  'results.reliabilityMedium',
  'pricing.title',
  'checkout.upgrade.newPackageLabel',
  'paymentStatus.packageLabel',
  'paymentStatus.packageValuePrefix',
  'workspace.unlockCtaPrefix',
  'workspace.importanceLabel.kritik',
  'workspace.original',
  'workspace.copiedText',
  'workspace.copyShort',
  'lifecycle.newAnalysisCta',
  'admin.gateTitle',
]);

function isLikelyUntranslated(key: string, value: string): boolean {
  if (SAME_VALUE_OK_KEYS.has(key)) return false;
  const v = value.trim();
  if (v.length < 4) return false; // too short to meaningfully judge (e.g. "·", "%", single words)
  if (/^[\d\s.,%$€₽·:/\-()]+$/.test(v)) return false; // numbers/symbols only, e.g. "0.49 USD", "24"
  if (!/[a-zA-ZçəğıöşüÇƏĞIİÖŞÜа-яА-ЯёЁ]/.test(v)) return false; // no actual letters at all
  return true;
}

describe('i18n content parity (untranslated-string heuristic)', () => {
  it.each(NON_AZ_LANGS)(
    '%s has no values byte-identical to az at the same key outside the documented allowlist',
    (lang) => {
      const suspicious: string[] = [];
      for (const [key, azValue] of Object.entries(flattened.az)) {
        const otherValue = flattened[lang][key];
        if (otherValue === undefined) continue; // already caught by the structural parity test
        if (otherValue === azValue && isLikelyUntranslated(key, azValue)) {
          suspicious.push(`${key} = ${JSON.stringify(azValue)}`);
        }
      }
      expect(suspicious, `${lang} has values identical to az (likely untranslated) — add to SAME_VALUE_OK_KEYS only if this is genuinely intentional`).toEqual([]);
    },
  );
});
