import OpenAI from 'openai';
import { applyScoringOverrides } from './scoring.js';

// Provider-neutral AI integration layer (OpenAI Responses API). Was Anthropic Claude
// (lib/anthropic.ts) until the provider migration — see CLAUDE.md for the history. Only the model
// (env `OPENAI_MODEL`, falls back to gpt-5.6-terra) reads from configuration; every other request
// parameter (reasoning effort, store) is fixed per the migration spec.
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-terra';

let client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI();
  return client;
}

export function aiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// ---------- error handling ----------
// Every OpenAI SDK error (auth, rate limit/quota, timeout, network, unavailable model, bad
// request) and every response-validation failure (refusal, truncation, invalid JSON, missing
// fields) gets normalized into one of these — callers/routes branch on `.code`, and `.message` is
// already a safe, Azerbaijani, user-facing string with no request/response internals or secrets.

export type AiErrorCode =
  | 'auth_error'
  | 'insufficient_credits'
  | 'rate_limited'
  | 'timeout'
  | 'network_error'
  | 'model_unavailable'
  | 'refusal'
  | 'invalid_response'
  | 'unknown';

export class AiError extends Error {
  code: AiErrorCode;
  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'AiError';
  }
}

/** Maps an OpenAI SDK exception to a safe AiError. Logs the real error server-side (never CV/
 * vacancy content, never the key — the SDK error objects don't carry the key either way) before
 * translating, so the raw provider error is never lost, just never forwarded to the client. */
function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  console.error('[ai]', err);
  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return new AiError('timeout', 'AI xidmətindən vaxtında cavab alınmadı.');
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return new AiError('network_error', 'AI xidməti ilə şəbəkə əlaqəsi qurula bilmədi.');
  }
  if (err instanceof OpenAI.AuthenticationError) {
    return new AiError('auth_error', 'AI xidməti üçün autentifikasiya xətası baş verdi (server konfiqurasiyası yoxlanılmalıdır).');
  }
  if (err instanceof OpenAI.PermissionDeniedError) {
    return new AiError('model_unavailable', 'AI modelinə giriş icazəsi yoxdur.');
  }
  if (err instanceof OpenAI.NotFoundError) {
    return new AiError('model_unavailable', 'Seçilmiş AI modeli hazırda mövcud deyil.');
  }
  if (err instanceof OpenAI.RateLimitError) {
    // OpenAI surfaces both "too many requests" and "out of credits" as HTTP 429; the SDK error's
    // own `code` (not the HTTP status) is what distinguishes them.
    const code = (err as unknown as { code?: string }).code;
    if (code === 'insufficient_quota') {
      return new AiError('insufficient_credits', 'AI xidmətinin balansı kifayət etmir.');
    }
    return new AiError('rate_limited', 'AI xidməti hazırda həddindən çox sorğu alır — bir az sonra yenidən cəhd edin.');
  }
  if (err instanceof OpenAI.BadRequestError) {
    return new AiError('invalid_response', 'AI sorğusu qəbul edilmədi.');
  }
  if (err instanceof OpenAI.APIError) {
    return new AiError('unknown', 'AI xidmətində gözlənilməz xəta baş verdi.');
  }
  return new AiError('unknown', 'AI xidmətində gözlənilməz xəta baş verdi.');
}

// ---------- structured-response validation ----------
// Never a bare JSON.parse: every structured call goes through this before a caller sees it.

function parseStructuredResponse<T>(response: OpenAI.Responses.Response, requiredKeys: string[]): T {
  if (response.status === 'incomplete') {
    const reason = response.incomplete_details?.reason;
    if (reason === 'content_filter') {
      throw new AiError('refusal', 'AI cavabı təhlükəsizlik filtri tərəfindən bloklandı.');
    }
    // Any other incomplete reason (most commonly hitting an internal length limit) means the JSON
    // is truncated mid-string — this is the same failure class this codebase has hit before with
    // the previous provider (see CLAUDE.md's max_tokens history); the fix there was tightening the
    // prompt's own output-size bounds, not anything on the parsing side.
    throw new AiError('invalid_response', 'AI cavabı natamam qaytarıldı (çox uzun cavab kəsilmiş ola bilər).');
  }

  for (const item of response.output ?? []) {
    if (item.type === 'message') {
      for (const part of item.content ?? []) {
        if (part.type === 'refusal') {
          throw new AiError('refusal', 'AI sorğunu emal etməkdən imtina etdi.');
        }
      }
    }
  }

  const text = response.output_text;
  if (!text || !text.trim()) {
    throw new AiError('invalid_response', 'AI cavabında mətn tapılmadı.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiError('invalid_response', 'AI cavabı düzgün JSON formatında deyil.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AiError('invalid_response', 'AI cavabı gözlənilən formatda deyil.');
  }

  const missing = requiredKeys.filter((k) => !(k in (parsed as Record<string, unknown>)));
  if (missing.length > 0) {
    throw new AiError('invalid_response', `AI cavabında tələb olunan sahələr çatışmır: ${missing.join(', ')}`);
  }

  return parsed as T;
}

/** Defensive numeric clamp for AI-proposed 0-100 scores that aren't otherwise re-derived by
 * scoring.ts (e.g. cvPresentationScore has no deterministic override, unlike compatibility). */
function clampScore(n: unknown, fallback = 0): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Shared call path for every structured (JSON-schema) generation in this file. Deliberately does
 * NOT set `max_output_tokens`: verified against OpenAI's own docs that reasoning models on the
 * Responses API (this family included) reject that parameter outright rather than just capping
 * output, so output-length is bounded entirely by explicit counts/limits in the prompt text
 * instead (the same approach already proven necessary in this codebase's prompt history). */
/** Safe timing log: durations and counts only — never CV/vacancy content, prompts, AI output
 * text, or the API key. Kept as one-line, greppable `[ai:timing]` entries so a real generation
 * can be broken down into DB-load / OpenAI-call / validate / DB-save stages after the fact. */
function logAiTiming(label: string, ms: number, extra?: Record<string, string | number>) {
  console.log(`[ai:timing] ${label} ${ms}ms${extra ? ' ' + JSON.stringify(extra) : ''}`);
}

async function createStructured<T>(
  client: OpenAI,
  params: {
    system: string;
    user: string;
    schemaName: string;
    schema: Record<string, unknown>;
    requiredKeys: string[];
    /** Per-request hard timeout (ms). A reasoning-model call that hangs past this throws
     * OpenAI.APIConnectionTimeoutError, already mapped to AiError('timeout', ...) below — this is
     * what actually enforces a generation's performance budget, not just a UI-side countdown.
     * Passing this also forces `maxRetries: 0` for the call (see below) — a real, verified
     * gotcha: the OpenAI SDK defaults to `maxRetries: 2` and, per its own source, a connection
     * *timeout* is one of the conditions it silently retries. Left at the default, a `timeoutMs`
     * of 75s doesn't cap wall-clock time at 75s at all — each retry gets its own fresh 75s budget,
     * so a genuinely slow prompt can take up to ~3x longer (confirmed live: a real call surfaced
     * its final timeout error over 2 minutes in, not ~75s) before the caller ever sees a rejection.
     * That silently breaks any caller relying on `timeoutMs` as an actual hard cap — so whenever a
     * timeout is requested, retries are disabled too, making one real hard cap instead of up to three. */
    timeoutMs?: number;
    /** Defaults to 'medium'. Reasoning effort is the dominant latency lever for this family of
     * models (confirmed via real timed comparisons, see CLAUDE.md / INTERVIEW_PLAYBOOK_FIX_REPORT.md)
     * — lower it for calls that are closer to "structured writing from already-extracted data"
     * than genuine multi-step reasoning. */
    reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high';
  },
): Promise<T> {
  const startedAt = Date.now();
  try {
    const response = await client.responses.create(
      {
        model: MODEL,
        reasoning: { effort: params.reasoningEffort ?? 'medium' },
        store: false,
        input: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.user },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: params.schemaName,
            schema: params.schema,
          },
        },
      },
      params.timeoutMs ? { timeout: params.timeoutMs, maxRetries: 0 } : undefined,
    );
    logAiTiming('openai_call', Date.now() - startedAt, { schema: params.schemaName, status: response.status ?? 'ok' });
    const validateStartedAt = Date.now();
    const parsed = parseStructuredResponse<T>(response, params.requiredKeys);
    logAiTiming('validate', Date.now() - validateStartedAt, { schema: params.schemaName });
    return parsed;
  } catch (err) {
    logAiTiming('openai_call_failed', Date.now() - startedAt, { schema: params.schemaName });
    throw toAiError(err);
  }
}

// ---------- shared schema fragments ----------

const requirementSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    category: { type: 'string' },
    importance: { type: 'string', enum: ['kritik', 'əsas', 'üstünlük'] },
    status: { type: 'string', enum: ['met', 'partial', 'missing', 'insufficient_info'] },
    evidence: { type: 'string' },
    explanation: { type: 'string' },
  },
  required: ['title', 'category', 'importance', 'status', 'evidence', 'explanation'],
  additionalProperties: false,
};

const matchResultSchema = {
  type: 'object',
  properties: {
    vacancyTitle: { type: 'string' },
    vacancyCompanyGuess: { type: 'string' },
    compatibility: { type: 'integer' },
    compatibilityLabel: { type: 'string' },
    cvPresentationScore: { type: 'integer' },
    cvPresentationLabel: { type: 'string' },
    realCompatibility: { type: 'integer' },
    realCompatibilityGap: { type: 'string' },
    mainRequirementsTotal: { type: 'integer' },
    mainRequirementsMet: { type: 'integer' },
    mainRequirementsPartial: { type: 'integer' },
    mainRequirementsMissing: { type: 'integer' },
    criticalGapsCount: { type: 'integer' },
    criticalGapSummary: { type: 'string' },
    hrScreeningEstimate: { type: 'integer' },
    reliability: { type: 'string', enum: ['yüksək', 'orta', 'aşağı'] },
    categoryScores: {
      type: 'array',
      items: {
        type: 'object',
        properties: { category: { type: 'string' }, score: { type: 'integer' } },
        required: ['category', 'score'],
        additionalProperties: false,
      },
    },
    requirements: { type: 'array', items: requirementSchema },
    strengths: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          text: { type: 'string' },
          evidenceFound: { type: 'boolean' },
          relatedRequirement: { type: 'string' },
        },
        required: ['title', 'text', 'evidenceFound', 'relatedRequirement'],
        additionalProperties: false,
      },
    },
    mostImportantMissingRequirement: { type: 'string' },
    mostImportantMissingExplanation: { type: 'string' },
    recommendationStatus: { type: 'string' },
    recommendationTone: { type: 'string', enum: ['positive', 'warning', 'negative'] },
    recommendationReasons: { type: 'array', items: { type: 'string' } },
    recommendationNextAction: { type: 'string' },
    weakPresentation: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          original: { type: 'string' },
          issue: { type: 'string' },
          suggestion: { type: 'string' },
        },
        required: ['original', 'issue', 'suggestion'],
        additionalProperties: false,
      },
    },
    improvementOpportunities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          impact: { type: 'string' },
        },
        required: ['title', 'impact'],
        additionalProperties: false,
      },
    },
  },
  required: [
    'vacancyTitle',
    'vacancyCompanyGuess',
    'compatibility',
    'compatibilityLabel',
    'cvPresentationScore',
    'cvPresentationLabel',
    'realCompatibility',
    'realCompatibilityGap',
    'mainRequirementsTotal',
    'mainRequirementsMet',
    'mainRequirementsPartial',
    'mainRequirementsMissing',
    'criticalGapsCount',
    'criticalGapSummary',
    'hrScreeningEstimate',
    'reliability',
    'categoryScores',
    'requirements',
    'strengths',
    'mostImportantMissingRequirement',
    'mostImportantMissingExplanation',
    'recommendationStatus',
    'recommendationTone',
    'recommendationReasons',
    'recommendationNextAction',
    'weakPresentation',
    'improvementOpportunities',
  ],
  additionalProperties: false,
};

export type MatchResult = {
  vacancyTitle: string;
  vacancyCompanyGuess: string;
  compatibility: number;
  compatibilityLabel: string;
  /** Independent quality axis from `compatibility`: how well the CV's *writing/presentation* sells
   * the candidate's real experience, regardless of how well that experience actually fits the
   * vacancy — e.g. a well-qualified candidate can still score low here if the CV undersells them. */
  cvPresentationScore: number;
  cvPresentationLabel: string;
  /** Candidate's true underlying fit if their real experience were fully reflected in the CV — always >= compatibility. */
  realCompatibility: number;
  /** Short explanation of the gap between realCompatibility and compatibility (why the CV understates the real fit). */
  realCompatibilityGap: string;
  mainRequirementsTotal: number;
  mainRequirementsMet: number;
  mainRequirementsPartial: number;
  mainRequirementsMissing: number;
  criticalGapsCount: number;
  criticalGapSummary: string;
  hrScreeningEstimate: number;
  reliability: 'yüksək' | 'orta' | 'aşağı';
  categoryScores: { category: string; score: number }[];
  requirements: {
    title: string;
    category: string;
    importance: 'kritik' | 'əsas' | 'üstünlük';
    status: 'met' | 'partial' | 'missing' | 'insufficient_info';
    evidence: string;
    explanation: string;
  }[];
  strengths: { title: string; text: string; evidenceFound: boolean; relatedRequirement: string }[];
  mostImportantMissingRequirement: string;
  mostImportantMissingExplanation: string;
  recommendationStatus: string;
  recommendationTone: 'positive' | 'warning' | 'negative';
  recommendationReasons: string[];
  recommendationNextAction: string;
  weakPresentation: { original: string; issue: string; suggestion: string }[];
  improvementOpportunities: { title: string; impact: string }[];
};

const LANG_NAME: Record<string, string> = { az: 'Azərbaycan', en: 'English' };

/** Resolves an `outputLanguage` value to the name used inside AI prompts. Any unrecognized value
 * (missing, or a removed legacy language like 'tr'/'ru') falls back to English, not Azerbaijani —
 * PeekMatch targets the global market, so an unsupported selection must never silently produce
 * Azerbaijani output. Exported so it's unit-testable independent of a live AI call. */
export function resolveLangName(outputLanguage: string): string {
  return LANG_NAME[outputLanguage] || 'English';
}

/** User's answer to "do you actually have this experience, just not reflected in your CV?" for the
 * single most-impactful missing requirement — null when never asked or not yet answered.
 * `details` is an optional free-text elaboration captured when the user answers "yes" (Truth
 * Lock: only material the candidate actually typed may be used, the AI must not invent specifics
 * beyond what's in `details`). */
export type SelfAttestedGap = { requirement: string; confirmed: boolean; details?: string } | null;

function selfAttestPromptNote(gap: SelfAttestedGap): string {
  if (!gap) return '';
  if (gap.confirmed) {
    const detail = gap.details?.trim()
      ? ` Namizədin verdiyi əlavə detallar (YALNIZ bunlardan istifadə et, əlavə uydurma): "${gap.details.trim()}".`
      : ' Namizəd əlavə detal verməyib — buna görə bu təcrübəni yalnız ümumi şəkildə qeyd et, konkret layihə/rəqəm uydurma.';
    return `\n\nNAMİZƏD TƏSDİQLƏDİ: Namizəd "${gap.requirement}" tələbi üzrə real təcrübəsi olduğunu, sadəcə CV-də tam əks olunmadığını təsdiqləyib.${detail}`;
  }
  return `\n\nNAMİZƏD TƏSDİQLƏDİ Kİ, YOXDUR: Namizəd "${gap.requirement}" tələbi üzrə təcrübəsi olmadığını bildirib. Bunu əlavə etmə və bu boşluğu açıq şəkildə necə izah edə biləcəyi barədə dürüst istiqamət ver.`;
}

/** Vision-based text extraction for image-only documents (e.g. a CV exported as a rasterized PDF
 * with no real text layer). Returns null when no API key is configured — callers fall back to
 * their normal "couldn't extract text" rejection in that case. Real API errors are thrown (as
 * AiError), not swallowed here — the one caller (cvParse.ts's tryOcrFallback) already wraps this
 * in its own try/catch and treats any failure as "OCR unavailable, fall through to rejection". */
export async function ocrDocumentImages(images: { data: string; mediaType: 'image/png' | 'image/jpeg' }[]): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const response = await client.responses.create({
      model: MODEL,
      reasoning: { effort: 'medium' },
      store: false,
      input: [
        {
          role: 'user',
          content: [
            ...images.map((img) => ({
              type: 'input_image' as const,
              detail: 'high' as const,
              image_url: `data:${img.mediaType};base64,${img.data}`,
            })),
            {
              type: 'input_text' as const,
              text: 'Bu şəkil(lər) bir sənədin səhifələridir (mətn qatı olmayan, şəkil əsaslı formatdan çıxarılıb). Şəkillərdə görünən BÜTÜN mətni, orijinal dilində və sırası ilə, sadə mətn formatında çıxar. Heç nə tərcümə etmə, şərh əlavə etmə, izah yazma — yalnız görünən mətni ötür.',
            },
          ],
        },
      ],
    });
    const text = response.output_text;
    return text && text.trim() ? text.trim() : null;
  } catch (err) {
    throw toAiError(err);
  }
}

export async function analyzeMatch(cvText: string, vacancyText: string, outputLanguage: string): Promise<MatchResult> {
  const client = getClient();
  if (!client) {
    console.warn('[ai] OPENAI_API_KEY not set — using offline fallback analyzer');
    return offlineAnalyze(cvText, vacancyText, outputLanguage);
  }

  const system = `Sən CV və vakansiya uyğunluğunu qiymətləndirən analitik köməkçisən (PeekMatch platforması üçün).
Prinsiplər:
- Yalnız CV-də real olaraq mövcud olan sübutlara əsaslan. Heç vaxt CV-də olmayan təcrübə uydurma.
- Açar söz sayına görə deyil, real təcrübənin vakansiyanın tələbləri ilə necə üst-üstə düşdüyünə görə qiymətləndir.
- Qismən uyğunluq ilə real boşluğu fərqləndir.
- Vakansiyadan 8-12 əsas tələb çıxar, hər birini kateqoriya, vaciblik (kritik/əsas/üstünlük), status və izahla qiymətləndir.
- 7 kateqoriya üzrə bal ver: İş təcrübəsi, Texniki bacarıqlar, Proqram və alətlər, Sektor təcrübəsi, Təhsil, Dil bilikləri, İdarəetmə və əməkdaşlıq (0-100 arası, əsassız yüksək başlanğıc dəyər vermə).
- "compatibility" — CV-də YAZILANLARA əsasən görünən uyğunluq (namizədin vakansiyaya nə dərəcədə uyğun olduğu). "cvPresentationScore" — TAMAMİLƏ AYRI bir ölçü: CV-nin YAZILIŞ keyfiyyəti, yəni mövcud real təcrübə nə qədər güclü təqdim olunub (məzmundan asılı olmayaraq). Yüksək compatibility ilə aşağı cvPresentationScore mümkündür (məs. namizəd əslində uyğundur, amma CV-si bunu zəif göstərir) — bunları qarışdırma, ikisi müstəqil qiymətləndirilməlidir. "realCompatibility" — namizədin CV-də tam əks olunmayan, lakin real təcrübəsinə uyğun olan potensial uyğunluq (həmişə compatibility-dən böyük və ya bərabər olmalıdır). "realCompatibilityGap" sahəsində bu fərqin səbəbini qısa izah et (məs. CV-də bir bacarıq zəif təsvir olunub, amma kontekstdən real təcrübə göründüyü halda).
- BÜTÜN sərbəst mətn sahələrini ${resolveLangName(outputLanguage)} dilində yaz — heç bir istisna yoxdur. Bura daxildir: compatibilityLabel, cvPresentationLabel, criticalGapSummary, mostImportantMissingRequirement, mostImportantMissingExplanation, recommendationStatus, recommendationReasons, recommendationNextAction, realCompatibilityGap, weakPresentation, improvementOpportunities, strengths (title/text/relatedRequirement), categoryScores-də "category" adları, VƏ requirements massivinin İÇİNDƏKİ hər elementin "title", "category", "evidence", "explanation" sahələri — bu daxili massiv sahələri xüsusilə tez-tez unudulur, onlara da eyni qayda tətbiq olunur. YALNIZ bu iki sahənin sabit dəyərləri dəyişməz qalmalıdır (bunlar tərcümə edilmir, kod onlara görə işləyir): "importance" (yalnız kritik/əsas/üstünlük) və "status" (yalnız met/partial/missing/insufficient_info).
- Ton: dəstəkləyici, dürüst, mühakimə etməyən. Zəmanət verən dil işlətmə.`;

  const user = `CV MƏTNİ:\n"""\n${cvText.slice(0, 15000)}\n"""\n\nVAKANSİYA MƏTNİ:\n"""\n${vacancyText.slice(0, 15000)}\n"""\n\nYuxarıdakı CV-ni bu vakansiya ilə müqayisə et və tam strukturlaşdırılmış nəticə qaytar.`;

  const result = await createStructured<MatchResult>(client, {
    system,
    user,
    schemaName: 'match_result',
    schema: matchResultSchema,
    requiredKeys: matchResultSchema.required,
  });
  result.compatibility = clampScore(result.compatibility);
  result.cvPresentationScore = clampScore(result.cvPresentationScore);
  result.hrScreeningEstimate = clampScore(result.hrScreeningEstimate);
  result.realCompatibility = clampScore(result.realCompatibility);
  // Downgrades unevidenced 'met' claims, then derives compatibility/categoryScores/requirement
  // counts/criticalGapsCount deterministically from the (corrected) requirements — the
  // authoritative score must be calculated by application logic, not freely generated by AI, and
  // every confirmed match must have valid CV evidence (both product rules). See scoring.ts.
  return applyScoringOverrides(result);
}

const OFFLINE_COPY: Record<
  'az' | 'en',
  {
    vacancyTitle: string;
    vacancyCompanyGuess: string;
    compatibilityLabel: (compatibility: number) => string;
    cvPresentationLabel: string;
    realCompatibilityGap: string;
    criticalGapSummary: string;
    categories: [string, string, string, string, string, string, string];
    mostImportantMissingRequirement: string;
    mostImportantMissingExplanation: string;
    recommendationStatus: string;
    recommendationReasons: string[];
    recommendationNextAction: string;
  }
> = {
  az: {
    vacancyTitle: 'Vakansiya',
    vacancyCompanyGuess: 'Naməlum şirkət',
    compatibilityLabel: (c) => (c >= 70 ? 'Yaxşı uyğunluq' : c >= 45 ? 'Orta uyğunluq' : 'Zəif uyğunluq'),
    cvPresentationLabel: 'AI konfiqurasiya olunmayıb — CV təqdimat keyfiyyəti hesablanmayıb.',
    realCompatibilityGap: 'AI konfiqurasiya olunmayıb — real və görünən uyğunluq fərqi hesablanmayıb.',
    criticalGapSummary: 'AI konfiqurasiya olunmayıb — bu nümunə göstəricidir.',
    categories: ['İş təcrübəsi', 'Texniki bacarıqlar', 'Proqram və alətlər', 'Sektor təcrübəsi', 'Təhsil', 'Dil bilikləri', 'İdarəetmə və əməkdaşlıq'],
    mostImportantMissingRequirement: 'OPENAI_API_KEY konfiqurasiya olunmayıb',
    mostImportantMissingExplanation:
      'Bu server üçün OPENAI_API_KEY mühit dəyişəni təyin edilməyib, ona görə real AI analizi əvəzinə nümunə göstəricilər göstərilir.',
    recommendationStatus: 'CV-ni uyğunlaşdırdıqdan sonra müraciət et',
    recommendationReasons: ['Real AI analizi üçün OPENAI_API_KEY tələb olunur.'],
    recommendationNextAction: 'Serverdə OPENAI_API_KEY mühit dəyişənini təyin edin.',
  },
  en: {
    vacancyTitle: 'Vacancy',
    vacancyCompanyGuess: 'Unknown company',
    compatibilityLabel: (c) => (c >= 70 ? 'Good match' : c >= 45 ? 'Moderate match' : 'Weak match'),
    cvPresentationLabel: 'AI is not configured — CV presentation quality was not computed.',
    realCompatibilityGap: 'AI is not configured — the real-vs-visible compatibility gap was not computed.',
    criticalGapSummary: 'AI is not configured — this is a placeholder figure.',
    categories: ['Work experience', 'Technical skills', 'Software & tools', 'Industry experience', 'Education', 'Language skills', 'Management & collaboration'],
    mostImportantMissingRequirement: 'OPENAI_API_KEY is not configured',
    mostImportantMissingExplanation:
      'The OPENAI_API_KEY environment variable is not set on this server, so placeholder figures are shown instead of a real AI analysis.',
    recommendationStatus: 'Apply after tailoring your CV',
    recommendationReasons: ['A real AI analysis requires OPENAI_API_KEY.'],
    recommendationNextAction: 'Set the OPENAI_API_KEY environment variable on the server.',
  },
};

function offlineAnalyze(cvText: string, vacancyText: string, outputLanguage: string): MatchResult {
  // Deterministic placeholder used only when no OPENAI_API_KEY is configured, so the rest of the
  // product flow can still be exercised end-to-end — localized so an English-selected analysis
  // never shows Azerbaijani placeholder copy (or vice versa) even in this offline path.
  const copy = OFFLINE_COPY[outputLanguage === 'en' ? 'en' : 'az'];
  const words = new Set(
    vacancyText
      .toLowerCase()
      .replace(/[^a-zəğıöşüçа-я0-9\s]/gi, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 4),
  );
  const cvLower = cvText.toLowerCase();
  let hits = 0;
  const sample = Array.from(words).slice(0, 10);
  for (const w of sample) if (cvLower.includes(w)) hits++;
  const compatibility = Math.min(92, Math.max(30, Math.round((hits / Math.max(1, sample.length)) * 100)));

  return {
    vacancyTitle: copy.vacancyTitle,
    vacancyCompanyGuess: copy.vacancyCompanyGuess,
    compatibility,
    compatibilityLabel: copy.compatibilityLabel(compatibility),
    cvPresentationScore: compatibility,
    cvPresentationLabel: copy.cvPresentationLabel,
    realCompatibility: compatibility,
    realCompatibilityGap: copy.realCompatibilityGap,
    mainRequirementsTotal: 10,
    mainRequirementsMet: Math.round((compatibility / 100) * 7),
    mainRequirementsPartial: 2,
    mainRequirementsMissing: 1,
    criticalGapsCount: 1,
    criticalGapSummary: copy.criticalGapSummary,
    hrScreeningEstimate: Math.max(10, compatibility - 8),
    reliability: 'orta',
    categoryScores: [
      { category: copy.categories[0], score: compatibility },
      { category: copy.categories[1], score: Math.max(20, compatibility - 15) },
      { category: copy.categories[2], score: Math.max(20, compatibility - 20) },
      { category: copy.categories[3], score: Math.max(20, compatibility - 5) },
      { category: copy.categories[4], score: 90 },
      { category: copy.categories[5], score: 85 },
      { category: copy.categories[6], score: Math.max(20, compatibility - 10) },
    ],
    requirements: [],
    strengths: [],
    mostImportantMissingRequirement: copy.mostImportantMissingRequirement,
    mostImportantMissingExplanation: copy.mostImportantMissingExplanation,
    recommendationStatus: copy.recommendationStatus,
    recommendationTone: 'warning',
    recommendationReasons: copy.recommendationReasons,
    recommendationNextAction: copy.recommendationNextAction,
    weakPresentation: [],
    improvementOpportunities: [],
  };
}

// ---------- CV Change Plan ----------
// Replaces the old "Tailored CV" (which silently generated a whole new CV). Instead of rewriting
// the candidate's CV wholesale, this analyses their EXISTING CV and returns a list of specific,
// evidence-cited change cards (rewrite/add/clarify/remove) — the "Truth Lock" product principle:
// every card must be traceable to the vacancy, the candidate's CV, or a confirmed answer. Cards
// with no cited CV evidence get filtered out deterministically by scoring.ts's
// sanitizeCvChangePlan() after parsing — this is application-code enforcement, not just a prompt
// promise, matching the same pattern already used for evidence-checking match requirements.

const cvChangeCardSchema = {
  type: 'object',
  properties: {
    section: { type: 'string' },
    currentText: { type: 'string' },
    whatToChange: { type: 'string' },
    problem: { type: 'string' },
    recommendedText: { type: 'string' },
    relatedRequirements: { type: 'array', items: { type: 'string' } },
    evidenceFromCv: { type: 'array', items: { type: 'string' } },
    priority: { type: 'string', enum: ['kritik', 'əsas', 'üstünlük'] },
    changeType: { type: 'string', enum: ['rewrite', 'add', 'clarify', 'remove'] },
  },
  required: [
    'section',
    'currentText',
    'whatToChange',
    'problem',
    'recommendedText',
    'relatedRequirements',
    'evidenceFromCv',
    'priority',
    'changeType',
  ],
  additionalProperties: false,
};

const cvChangePlanSchema = {
  type: 'object',
  properties: { cards: { type: 'array', items: cvChangeCardSchema } },
  required: ['cards'],
  additionalProperties: false,
};

export type CvChangeCard = {
  section: string;
  /** Empty string for 'add' cards (there's nothing existing to quote). */
  currentText: string;
  /** One short imperative sentence: what to change (e.g. "Bu mətni daha konkret yazın."). Length-
   * capped in scoring.ts's sanitizeCvChangePlan, not just prompted. */
  whatToChange: string;
  /** One short sentence: why it matters for this vacancy. Same length-cap treatment. */
  problem: string;
  recommendedText: string;
  relatedRequirements: string[];
  /** Must cite real CV content, kept concise (a short reference, not a full quoted paragraph).
   * Empty is only acceptable for changeType 'clarify' (info the candidate hasn't confirmed yet) —
   * enforced by scoring.ts's sanitizeCvChangePlan. */
  evidenceFromCv: string[];
  priority: 'kritik' | 'əsas' | 'üstünlük';
  changeType: 'rewrite' | 'add' | 'clarify' | 'remove';
};

export type CvChangePlan = { cards: CvChangeCard[] };

export async function generateCvChangePlan(
  cvText: string,
  vacancyText: string,
  match: MatchResult,
  outputLanguage: string,
  selfAttestedGap: SelfAttestedGap = null,
): Promise<CvChangePlan> {
  const client = getClient();
  if (!client) {
    return {
      cards: [
        {
          section: outputLanguage === 'en' ? 'CV Change Plan' : 'CV Dəyişiklik Planı',
          currentText: '',
          whatToChange: outputLanguage === 'en' ? 'Configure OPENAI_API_KEY to generate real recommendations.' : 'Real tövsiyələr üçün OPENAI_API_KEY konfiqurasiya edin.',
          problem: outputLanguage === 'en' ? 'OPENAI_API_KEY is not configured.' : 'OPENAI_API_KEY konfiqurasiya olunmayıb.',
          recommendedText: '',
          relatedRequirements: [],
          evidenceFromCv: [],
          priority: 'əsas',
          changeType: 'clarify',
        },
      ],
    };
  }

  const system = `Sən namizədin MÖVCUD CV-sini konkret vakansiyaya görə təhlil edən köməkçisən (PeekMatch platforması üçün). Sən YENİ CV yazmırsan — mövcud CV-də DƏQİQ nəyin dəyişdirilməli, əlavə edilməli, aydınlaşdırılmalı və ya çıxarılmalı olduğunu göstərirsən.

TRUTH LOCK prinsipi (məcburidir):
- Hər kart YALNIZ vakansiyaya, namizədin CV-sindəki real məzmuna, və ya namizədin təsdiqlədiyi məlumata əsaslanmalıdır.
- Heç vaxt CV-də olmayan təcrübə, vəzifə, şirkət, tarix, alət, nəticə, rəqəm, təhsil və ya sertifikat uydurma.
- "evidenceFromCv" sahəsində HƏR KART üçün CV-dən konkret sitat/istinad göstər (changeType='clarify' xaric — bu, hələ təsdiqlənməmiş məlumat üçündür, ona görə sübut tələb olunmur).
- Əgər vakansiya tələb etdiyi bir şey CV-də aydın görünmürsə, bunu "clarify" tipli kartla qeyd et (namizədə sual kimi), heç vaxt "rewrite"/"add" kartında uydurma.

changeType: "rewrite" (mövcud mətn var, aydın/spesifik yazılmalıdır), "add" (CV-nin başqa yerində olan təcrübə daha güclü bölməyə əlavə edilməlidir — currentText boş qala bilər), "clarify" (çox qeyri-müəyyəndir, namizədin təsdiqi lazımdır), "remove" (təkrarlanan/əhəmiyyətsiz/köhnəlmiş, müraciəti zəiflədir).
priority: "kritik" (vakansiya üçün həlledici), "əsas" (əhəmiyyətli), "üstünlük" (könüllü təkmilləşdirmə) — uyğunluq analizindəki eyni səviyyə adlarından istifadə et.

6-10 kart hazırla, ən vacib "kritik" kartdan başlayaraq. QISA VƏ KONKRET YAZ, uzun analitik izah vermə:
- "whatToChange": NƏ dəyişməli olduğunu bir qısa, əmr formalı cümlə ilə de (məs. "Bu mətni daha konkret yazın.", "Bu təcrübəni ayrıca göstərin."). Maksimum 1 cümlə, ~120 simvol.
- "problem": NİYƏ vacib olduğunu bir qısa cümlə ilə izah et, mümkünsə vakansiya ilə bağla (məs. "Vakansiyada mobil məhsul təcrübəsi vacibdir."). Maksimum 1 cümlə, ~160 simvol. Uzun təhlil yazma, ümumi ifadələr işlətmə.
- "recommendedText": birbaşa kopyalanıb istifadə oluna bilən, hazır mətn — maksimum 60-90 söz (1 qısa paraqraf və ya 1-3 bullet). Artıq kontekst/arayış əlavə etmə.
- "evidenceFromCv": hər istinad QISA olsun (məs. "Product Owner — PASHA Life"), CV-dən tam paraqraf sitat gətirmə.
BÜTÜN mətn sahələrini (section, currentText, whatToChange, problem, recommendedText, relatedRequirements, evidenceFromCv) ${resolveLangName(outputLanguage)} dilində yaz.`;

  const user = `MÖVCUD CV:\n"""\n${cvText.slice(0, 15000)}\n"""\n\nVAKANSİYA:\n"""\n${vacancyText.slice(0, 8000)}\n"""\n\nUYĞUNLUQ ANALİZİ: ${JSON.stringify({
    compatibility: match.compatibility,
    cvPresentationScore: match.cvPresentationScore,
    requirements: match.requirements.slice(0, 15),
    weakPresentation: match.weakPresentation,
  })}\n\nBu CV üçün CV Dəyişiklik Planı hazırla.${selfAttestPromptNote(selfAttestedGap)}`;

  return createStructured<CvChangePlan>(client, {
    system,
    user,
    schemaName: 'cv_change_plan',
    schema: cvChangePlanSchema,
    requiredKeys: cvChangePlanSchema.required,
  });
}

// ---------- Interview Playbook ----------

// Slim item: no importantPoints/missingInformation/commonMistakes. Those three fields are not
// part of the product's required Interview Playbook content (question, why, answerFramework,
// relatedRequirement, relevantExperience, likelyFollowUps, priority are) and were dropped
// specifically to shrink OUTPUT SIZE per call — verified live to be the dominant latency lever for
// this model, more so than reasoning effort or prompt size alone (see INTERVIEW_PLAYBOOK_FIX_REPORT.md
// for the measured comparison: a single 3-item category call at this slim shape completed in
// ~11s; the old combined 9-item/10-field call took ~30s; the original 15-item/10-field call
// routinely exceeded the old 75s timeout outright).
function questionItem() {
  return {
    type: 'object',
    properties: {
      question: { type: 'string' },
      why: { type: 'string' },
      answerFramework: { type: 'string' },
      priority: { type: 'string', enum: ['veryLikely', 'likely', 'additional'] },
      relatedRequirement: { type: 'string' },
      relevantExperience: { type: 'string' },
      likelyFollowUps: { type: 'array', items: { type: 'string' } },
    },
    required: ['question', 'why', 'answerFramework', 'priority', 'relatedRequirement', 'relevantExperience', 'likelyFollowUps'],
    additionalProperties: false,
  } as const;
}

const criticalGapStrategySchema = {
  type: 'object',
  properties: {
    requirement: { type: 'string' },
    situation: { type: 'string', enum: ['has_experience', 'similar_experience', 'no_experience'] },
    guidance: { type: 'string' },
  },
  required: ['requirement', 'situation', 'guidance'],
  additionalProperties: false,
};

const starStorySchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    situation: { type: 'string' },
    task: { type: 'string' },
    action: { type: 'string' },
    result: { type: 'string' },
    missingDetail: { type: 'string' },
  },
  required: ['title', 'situation', 'task', 'action', 'result', 'missingDetail'],
  additionalProperties: false,
};

// Split into FOUR independent schemas generated in parallel (see generateInterviewPrep below) —
// one per question category (hr/situational/technical) plus one "support" call, rather than one
// combined "core" call for all three question categories. Verified live: output size (item count
// x fields per item) is the dominant latency driver for this model, roughly linear — a single
// category's 3-5 questions completes in ~11-17s, while all three combined in one call (9 items)
// took ~30s and the original 15-item/10-field version routinely exceeded 75s outright. Four small
// parallel calls bounded by the slowest one beats one or two large ones. Each callsite still gets
// back one merged InterviewPrep object with the exact same shape as before.
const interviewHrSchema = {
  type: 'object',
  properties: {
    strongestTopic: { type: 'string' },
    biggestRisk: { type: 'string' },
    tellMeAboutYourself: { type: 'string' },
    hrQuestions: { type: 'array', items: questionItem() },
  },
  required: ['strongestTopic', 'biggestRisk', 'tellMeAboutYourself', 'hrQuestions'],
  additionalProperties: false,
};

const interviewSituationalSchema = {
  type: 'object',
  properties: { situational: { type: 'array', items: questionItem() } },
  required: ['situational'],
  additionalProperties: false,
};

const interviewTechnicalSchema = {
  type: 'object',
  properties: { technical: { type: 'array', items: questionItem() } },
  required: ['technical'],
  additionalProperties: false,
};

const interviewSupportSchema = {
  type: 'object',
  properties: {
    criticalGapStrategies: { type: 'array', items: criticalGapStrategySchema },
    starStories: { type: 'array', items: starStorySchema },
    cvVerificationQuestions: { type: 'array', items: { type: 'string' } },
    gapExplanations: { type: 'array', items: { type: 'string' } },
    questionsToAsk: { type: 'array', items: { type: 'string' } },
  },
  required: ['criticalGapStrategies', 'starStories', 'cvVerificationQuestions', 'gapExplanations', 'questionsToAsk'],
  additionalProperties: false,
};

type InterviewHr = Pick<InterviewPrep, 'strongestTopic' | 'biggestRisk' | 'tellMeAboutYourself' | 'hrQuestions'>;
type InterviewSituational = Pick<InterviewPrep, 'situational'>;
type InterviewTechnical = Pick<InterviewPrep, 'technical'>;
type InterviewSupport = Pick<
  InterviewPrep,
  'criticalGapStrategies' | 'starStories' | 'cvVerificationQuestions' | 'gapExplanations' | 'questionsToAsk'
>;

/** Hard per-call timeout matching this feature's performance budget (target under 20s, acceptable
 * max 30s, so each of the 4 parallel calls gets a 28s cap — enforced by the OpenAI client itself,
 * see createStructured — leaving ~2s of margin under the 30s job deadline for JSON validation and
 * the DB write that follow). A hung call fails fast as AiError('timeout', ...) instead of hanging
 * indefinitely. Exported so a test can assert it never silently regresses past the 30s budget. */
export const INTERVIEW_CALL_TIMEOUT_MS = 28_000;

type InterviewQuestion = {
  question: string;
  why: string;
  answerFramework: string;
  priority: 'veryLikely' | 'likely' | 'additional';
  relatedRequirement: string;
  relevantExperience: string;
  likelyFollowUps: string[];
};

export type InterviewPrep = {
  /** The "60-second introduction" framework. */
  strongestTopic: string;
  biggestRisk: string;
  tellMeAboutYourself: string;
  hrQuestions: InterviewQuestion[];
  situational: InterviewQuestion[];
  technical: InterviewQuestion[];
  /** Honest response strategy per kritik-importance missing/partial requirement — never advises lying. */
  criticalGapStrategies: { requirement: string; situation: 'has_experience' | 'similar_experience' | 'no_experience'; guidance: string }[];
  /** STAR frameworks built only from real CV evidence, not fabricated anecdotes. */
  starStories: { title: string; situation: string; task: string; action: string; result: string; missingDetail: string }[];
  cvVerificationQuestions: string[];
  gapExplanations: string[];
  questionsToAsk: string[];
};

export async function generateInterviewPrep(
  cvText: string,
  match: MatchResult,
  outputLanguage: string,
  selfAttestedGap: SelfAttestedGap = null,
): Promise<InterviewPrep> {
  const client = getClient();
  if (!client) {
    return {
      strongestTopic: '—',
      biggestRisk: '—',
      tellMeAboutYourself: outputLanguage === 'en' ? 'OPENAI_API_KEY is not configured.' : 'OPENAI_API_KEY konfiqurasiya olunmayıb.',
      hrQuestions: [],
      situational: [],
      technical: [],
      criticalGapStrategies: [],
      starStories: [],
      cvVerificationQuestions: [],
      gapExplanations: [],
      questionsToAsk: [],
    };
  }
  const truthLock = `TRUTH LOCK prinsipi (məcburidir): heç vaxt olmayan təcrübəni, hekayəni və ya nəticəni uydurma. "relevantExperience" və "starStories" YALNIZ CV-də real mövcud olan məzmuna əsaslanmalıdır — əgər hekayə üçün vacib bir detal (rəqəm, nəticə, tarix) CV-də yoxdursa, onu uydurmaq əvəzinə "missingDetail" sahəsində qeyd et.`;
  const langInstruction = `BÜTÜN mətn sahələrini ${resolveLangName(outputLanguage)} dilində yaz — heç bir istisna yoxdur, bura bütün massivlərin İÇİNDƏKİ hər elementin bütün sahələri də daxildir. YALNIZ "priority" və "situation" sahələrinin sabit dəyərləri (veryLikely/likely/additional, has_experience/similar_experience/no_experience) dəyişməz qalmalıdır.`;
  const conciseInstruction = `QISA YAZ: "why" maksimum 1 cümlə, "answerFramework" maksimum 2 cümlə, "relevantExperience" maksimum 1 cümlə, "likelyFollowUps" maksimum 2 element.`;
  const gapNote = selfAttestPromptNote(selfAttestedGap);

  // Condensed, already-extracted context instead of the complete raw CV + complete raw vacancy
  // text: the vacancy's raw text is dropped entirely (match.requirements/vacancyTitle/
  // vacancyCompanyGuess already encode what the vacancy needs — re-sending the raw posting is
  // redundant context, not new information), and the requirement list is filtered down to
  // critical/core only (üstünlük/"nice to have" requirements rarely drive interview questions).
  // cvExcerpt is still real, close-to-full CV text (not just structured fields) because
  // relevantExperience/starStories/tellMeAboutYourself need genuine narrative grounding to satisfy
  // Truth Lock — this trims redundant *vacancy* content, not the candidate's own real experience.
  const condensedContext = JSON.stringify({
    role: match.vacancyTitle,
    company: match.vacancyCompanyGuess,
    requirements: match.requirements
      .filter((r) => r.importance !== 'üstünlük')
      .slice(0, 12)
      .map((r) => ({ title: r.title, importance: r.importance, status: r.status, evidence: r.evidence })),
    strengths: match.strengths.slice(0, 6).map((s) => ({ title: s.title, text: s.text })),
  });
  const cvExcerpt = cvText.slice(0, 5000);
  // starStories/gapExplanations benefit from deeper narrative grounding than a single Q&A answer
  // does, so the support call gets a larger (but still far short of the old 12000-char) excerpt.
  const cvExcerptForSupport = cvText.slice(0, 7000);

  const questionCallPreamble = (focus: string) => `Sən namizədi müsahibəyə hazırlayan köməkçisən — hazırladığın "Müsahibə Playbook"u ("Interview Playbook") vakansiyaya və namizədin real CV-sinə əsaslanmalıdır, ümumi sual siyahısı deyil. Bu dəfə YALNIZ ${focus} hazırlayırsan.

${truthLock}

Hər sual üçün: "priority" (veryLikely/likely/additional), "relatedRequirement", "relevantExperience", "likelyFollowUps".

${conciseInstruction}

${langInstruction}`;

  const contextBlock = `NAMİZƏDİN CV-Sİ:\n"""\n${cvExcerpt}\n"""\n\nVAKANSİYA VƏ UYĞUNLUQ MƏLUMATI: ${condensedContext}`;

  const hrSystem = `${questionCallPreamble('3-5 HR sualı və "Tell me about yourself" təqdimatını')}`;
  const hrUser = `${contextBlock}\n\nDƏQİQ HƏDD (aşma): 3-5 HR sualı. Həmçinin "strongestTopic" (ən güclü mövzu, 1 cümlə), "biggestRisk" (ən vacib risk, 1 cümlə), "tellMeAboutYourself" (60 saniyəlik təqdimat, maksimum 3 cümlə) hazırla.${gapNote}`;

  const situationalSystem = questionCallPreamble('3-5 situasiya sualını');
  const situationalUser = `${contextBlock}\n\nDƏQİQ HƏDD (aşma): 3-5 situasiya sualı.${gapNote}`;

  const technicalSystem = questionCallPreamble('3-5 texniki sualı');
  const technicalUser = `${contextBlock}\n\nDƏQİQ HƏDD (aşma): 3-5 texniki sual.${gapNote}`;

  const supportSystem = `Sən namizədi müsahibəyə hazırlayan köməkçisən (PeekMatch platforması üçün) — bu dəfə kritik boşluqlar üçün cavab strategiyası, STAR hekayə strukturları və müsahibəyə əlavə suallar hazırlayırsan.

${truthLock}

"criticalGapStrategies": kritik əhəmiyyətli, qarşılanmayan/qismən qarşılanan hər tələb üçün — "situation" sahəsini namizədin CV-sinə əsasən müəyyən et (has_experience: əslində var amma aydın deyil, similar_experience: oxşar alət/bacarıq var, no_experience: heç yoxdur) və hər halda DÜRÜST məsləhət ver (maksimum 2 cümlə). HEÇ VAXT yalan danışmağı məsləhət görmə.

"starStories": CV-dəki real təcrübələrdən uyğun 2-3 hekayə strukturu çıxar (Situation/Task/Action/Result, hər biri maksimum 1-2 cümlə) — UYDURMA, yalnız CV-də olan real layihə/rolları strukturlaşdır, əskik detalı missingDetail-də qeyd et.

"cvVerificationQuestions", "gapExplanations", "questionsToAsk": hər biri qısa, ən çoxu 4 element.

${langInstruction}`;
  const supportUser = `NAMİZƏDİN CV-Sİ:\n"""\n${cvExcerptForSupport}\n"""\n\nVAKANSİYA VƏ UYĞUNLUQ MƏLUMATI: ${condensedContext}\n\nDƏQİQ HƏDDLƏR (bu ədədləri aşma): ən çoxu 4 kritik boşluq strategiyası, 2-3 STAR hekayə strukturu, ən çoxu 4 CV-yoxlama sualı, ən çoxu 4 kritik boşluğun izahı və müsahibəçiyə veriləcək ən çoxu 4 sual hazırla.${gapNote}`;

  const [hr, situational, technical, support] = await Promise.all([
    createStructured<InterviewHr>(client, {
      system: hrSystem,
      user: hrUser,
      schemaName: 'interview_hr',
      schema: interviewHrSchema,
      requiredKeys: interviewHrSchema.required,
      timeoutMs: INTERVIEW_CALL_TIMEOUT_MS,
      reasoningEffort: 'low',
    }),
    createStructured<InterviewSituational>(client, {
      system: situationalSystem,
      user: situationalUser,
      schemaName: 'interview_situational',
      schema: interviewSituationalSchema,
      requiredKeys: interviewSituationalSchema.required,
      timeoutMs: INTERVIEW_CALL_TIMEOUT_MS,
      reasoningEffort: 'low',
    }),
    createStructured<InterviewTechnical>(client, {
      system: technicalSystem,
      user: technicalUser,
      schemaName: 'interview_technical',
      schema: interviewTechnicalSchema,
      requiredKeys: interviewTechnicalSchema.required,
      timeoutMs: INTERVIEW_CALL_TIMEOUT_MS,
      reasoningEffort: 'low',
    }),
    createStructured<InterviewSupport>(client, {
      system: supportSystem,
      user: supportUser,
      schemaName: 'interview_prep_support',
      schema: interviewSupportSchema,
      requiredKeys: interviewSupportSchema.required,
      timeoutMs: INTERVIEW_CALL_TIMEOUT_MS,
      reasoningEffort: 'low',
    }),
  ]);

  return { ...hr, ...situational, ...technical, ...support };
}
