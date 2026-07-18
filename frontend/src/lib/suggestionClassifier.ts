import type { Suggestion } from './adminApi';

export type Theme = 'Yeni funksiya tələbi' | 'Qiymətləndirmə' | 'Ödəniş problemi' | 'İstifadə problemi' | 'Ümumi təcrübə';
export type Sentiment = 'Konstruktiv' | 'Mənfi' | 'Neytral';
export type Priority = 'Yüksək' | 'Orta' | 'Aşağı';

/** Deterministic keyword classifier, not a real AI call — mirrors the original design's client-side
 * "AI structuring" of feedback (cosmetic display only, doesn't affect product behavior). */
export function classifySuggestion(sg: Suggestion): { theme: Theme; sentiment: Sentiment; priority: Priority } {
  const text = sg.text.toLowerCase();
  let theme: Theme = 'Ümumi təcrübə';
  let sentiment: Sentiment = 'Neytral';
  let priority: Priority = 'Orta';

  if (/linkedin|import|müqayisə|e-poçt|göndər/.test(text)) {
    theme = 'Yeni funksiya tələbi';
    sentiment = 'Konstruktiv';
    priority = /linkedin|müqayisə/.test(text) ? 'Yüksək' : 'Orta';
  }
  if (/endirim|qiymət|bahal|ucuz/.test(text) || sg.category === 'Qiymət') {
    theme = 'Qiymətləndirmə';
    sentiment = 'Konstruktiv';
    priority = 'Orta';
  }
  if (/alınmadı|xəta|işləmir|çətindir|kiçik/.test(text)) {
    theme = /kart|ödəniş/.test(text) ? 'Ödəniş problemi' : 'İstifadə problemi';
    sentiment = 'Mənfi';
    priority = 'Yüksək';
  }
  return { theme, sentiment, priority };
}
