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
    tools: 'Software & Tools',
    sector: 'Industry Experience',
    education: 'Education',
    languages: 'Languages',
    management: 'Management & Collaboration',
  },
};

const REVERSE_LOOKUP: Record<string, CategoryKey> = {};
for (const lang of Object.keys(CATEGORY_NAMES) as Lang[]) {
  for (const key of CATEGORY_KEYS) {
    REVERSE_LOOKUP[CATEGORY_NAMES[lang][key].trim().toLowerCase()] = key;
  }
}

/** Returns `raw` re-rendered in `lang` if it matches one of the 7 known categories in any
 * language; otherwise returns `raw` unchanged (defensive fallback for unrecognized AI output). */
export function localizeCategoryName(raw: string, lang: Lang): string {
  const key = REVERSE_LOOKUP[raw.trim().toLowerCase()];
  return key ? CATEGORY_NAMES[lang][key] : raw;
}
