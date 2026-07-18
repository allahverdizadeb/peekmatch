import { apiRequest, type SuggestionCategory } from './api';

const STORAGE_KEY = 'pm_admin_key';

export function getAdminKey(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function setAdminKey(key: string) {
  sessionStorage.setItem(STORAGE_KEY, key);
}

export function clearAdminKey() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export interface Suggestion {
  id: string;
  createdAt: string;
  category: SuggestionCategory;
  text: string;
  email: string;
}

/** Validates a candidate key by actually calling the admin endpoint — 200 means it's good. */
export function listSuggestions(key: string) {
  return apiRequest<Suggestion[]>('/suggestions', { headers: { 'x-admin-key': key } });
}
