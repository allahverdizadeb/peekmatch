import { az } from './az';
import { en } from './en';
import type { LegalContent, LegalDoc } from './az';
import type { Lang } from '../i18n/locales';

export type { LegalContent, LegalDoc };

export const LEGAL_CONTENT: Record<Lang, LegalContent> = { az, en };
