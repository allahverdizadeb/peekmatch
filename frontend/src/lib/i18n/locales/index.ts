import { az } from './az';
import { en } from './en';
import type { Dict } from './az';

export type { Dict };
export type Lang = 'az' | 'en';

export const LOCALES: Record<Lang, Dict> = { az, en };

export const LANGUAGES: { code: Lang; flag: string; name: string }[] = [
  { code: 'az', flag: '🇦🇿', name: 'Azərbaycan dili' },
  { code: 'en', flag: '🇬🇧', name: 'English' },
];
