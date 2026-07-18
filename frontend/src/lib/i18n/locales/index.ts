import { az } from './az';
import { en } from './en';
import { tr } from './tr';
import { ru } from './ru';
import type { Dict } from './az';

export type { Dict };
export type Lang = 'az' | 'en' | 'tr' | 'ru';

export const LOCALES: Record<Lang, Dict> = { az, en, tr, ru };

export const LANGUAGES: { code: Lang; flag: string; name: string }[] = [
  { code: 'az', flag: '🇦🇿', name: 'Azərbaycan dili' },
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'tr', flag: '🇹🇷', name: 'Türkçe' },
  { code: 'ru', flag: '🇷🇺', name: 'Русский' },
];
