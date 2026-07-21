import type { Lang } from './i18n/locales';

/** analyzeMatch always scores these same 7 fixed dimensions, but the AI writes the `category`
 * name as free text translated into whatever `outputLanguage` was active when the analysis was
 * created — so it stays frozen in that language even after the user switches the site's UI
 * language later. Since it's a closed set of 7 known categories, we recognize the name in either
 * of the 2 languages and re-render it in the current UI language, without needing a backend
 * change or touching already-generated analyses. */
const CATEGORY_KEYS = ['experience', 'technical', 'tools', 'sector', 'education', 'languages', 'management'] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

const CATEGORY_NAMES: Record<Lang, Record<CategoryKey, string>> = {
  az: {
    experience: 'İş təcrübəsi',
    technical: 'Texniki bacarıqlar',
    tools: 'Proqram və alətlər',
    sector: 'Sektor təcrübəsi',
    education: 'Təhsil',
    languages: 'Dil bilikləri',
    management: 'İdarəetmə və əməkdaşlıq',
  },
  en: {
    experience: 'Work Experience',
    technical: 'Technical Skills',
    tools: 'Software and Tools',
    sector: 'Industry Experience',
    education: 'Education',
    languages: 'Language Skills',
    management: 'Management and Collaboration',
  },
};

// The English side isn't a fixed schema enum — the AI free-translates the Azerbaijani category
// concepts into English, so exact phrasing can vary between calls (confirmed live: "Software and
// Tools" vs. an earlier "Software & Tools" guess in this dictionary silently failed to match and
// fell through untranslated). Normalizing "&"/"and" and collapsing whitespace before comparing
// makes the lookup resilient to that variance instead of requiring byte-identical strings.
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ');
}

const REVERSE_LOOKUP: Record<string, CategoryKey> = {};
for (const lang of Object.keys(CATEGORY_NAMES) as Lang[]) {
  for (const key of CATEGORY_KEYS) {
    REVERSE_LOOKUP[normalize(CATEGORY_NAMES[lang][key])] = key;
  }
}

/** Returns `raw` re-rendered in `lang` if it matches one of the 7 known categories in any
 * language; otherwise returns `raw` unchanged (defensive fallback for unrecognized AI output). */
export function localizeCategoryName(raw: string, lang: Lang): string {
  const key = REVERSE_LOOKUP[normalize(raw)];
  return key ? CATEGORY_NAMES[lang][key] : raw;
}
