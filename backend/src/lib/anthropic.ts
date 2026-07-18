import Anthropic from '@anthropic-ai/sdk';
import { applyScoringOverrides } from './scoring.js';

// Cheapest current Claude tier, per explicit cost-cutting instruction (was claude-opus-4-8 for
// every call). Used for generateTailoredCv, generateCoverLetter, and OCR — all verified to
// reliably follow outputLanguage on real test runs.
const MODEL = 'claude-haiku-4-5-20251001';
const OCR_MODEL = MODEL;
// analyzeMatch and generateInterviewPrep produce large, deeply-nested JSON (a `requirements[]` /
// `hrQuestions[]`+`situational[]`+`technical[]` array of several objects, each with multiple free
// text fields). Verified live that MODEL (haiku) does NOT reliably apply the outputLanguage
// instruction to those nested fields — they kept coming back in Azerbaijani regardless of the
// requested language, even after the system prompt was rewritten to explicitly call out every
// nested field name. Stepping these two up to sonnet fixed it. Do not move these back to MODEL
// without re-verifying nested-field language compliance with a real non-Azerbaijani test run.
const ANALYSIS_MODEL = 'claude-sonnet-5';

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
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

/** User's answer to "do you actually have this experience, just not reflected in your CV?" for the
 * single most-impactful missing requirement — null when never asked or not yet answered. */
export type SelfAttestedGap = { requirement: string; confirmed: boolean } | null;

function selfAttestPromptNote(gap: SelfAttestedGap): string {
  if (!gap) return '';
  return gap.confirmed
    ? `\n\nNAMİZƏD TƏSDİQLƏDİ: Namizəd "${gap.requirement}" tələbi üzrə real təcrübəsi olduğunu, sadəcə CV-də tam əks olunmadığını təsdiqləyib. Bu təcrübəni dürüst və ümumi şəkildə (uydurma detallar olmadan) daxil et.`
    : `\n\nNAMİZƏD TƏSDİQLƏDİ Kİ, YOXDUR: Namizəd "${gap.requirement}" tələbi üzrə təcrübəsi olmadığını bildirib. Bunu əlavə etmə və bu boşluğu açıq şəkildə necə izah edə biləcəyi barədə dürüst istiqamət ver.`;
}

/** Vision-based text extraction for image-only documents (e.g. a CV exported as a rasterized PDF
 * with no real text layer). Returns null when no API key is configured — callers fall back to
 * their normal "couldn't extract text" rejection in that case. */
export async function ocrDocumentImages(images: { data: string; mediaType: 'image/png' | 'image/jpeg' }[]): Promise<string | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  const response = await anthropic.messages.create({
    model: OCR_MODEL,
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: [
          ...images.map((img) => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: img.mediaType, data: img.data },
          })),
          {
            type: 'text' as const,
            text: 'Bu şəkil(lər) bir sənədin səhifələridir (mətn qatı olmayan, şəkil əsaslı formatdan çıxarılıb). Şəkillərdə görünən BÜTÜN mətni, orijinal dilində və sırası ilə, sadə mətn formatında çıxar. Heç nə tərcümə etmə, şərh əlavə etmə, izah yazma — yalnız görünən mətni ötür.',
          },
        ],
      },
    ],
  });
  const block = response.content.find((b) => b.type === 'text');
  return block && block.type === 'text' ? block.text.trim() : null;
}

export async function analyzeMatch(
  cvText: string,
  vacancyText: string,
  outputLanguage: string,
): Promise<MatchResult> {
  const anthropic = getClient();
  if (!anthropic) {
    console.warn('[anthropic] ANTHROPIC_API_KEY not set — using offline fallback analyzer');
    return offlineAnalyze(cvText, vacancyText);
  }

  const system = `Sən CV və vakansiya uyğunluğunu qiymətləndirən analitik köməkçisən (PeekMatch platforması üçün).
Prinsiplər:
- Yalnız CV-də real olaraq mövcud olan sübutlara əsaslan. Heç vaxt CV-də olmayan təcrübə uydurma.
- Açar söz sayına görə deyil, real təcrübənin vakansiyanın tələbləri ilə necə üst-üstə düşdüyünə görə qiymətləndir.
- Qismən uyğunluq ilə real boşluğu fərqləndir.
- Vakansiyadan 8-12 əsas tələb çıxar, hər birini kateqoriya, vaciblik (kritik/əsas/üstünlük), status və izahla qiymətləndir.
- 7 kateqoriya üzrə bal ver: İş təcrübəsi, Texniki bacarıqlar, Proqram və alətlər, Sektor təcrübəsi, Təhsil, Dil bilikləri, İdarəetmə və əməkdaşlıq (0-100 arası, əsassız yüksək başlanğıc dəyər vermə).
- "compatibility" — CV-də YAZILANLARA əsasən görünən uyğunluq. "realCompatibility" — namizədin CV-də tam əks olunmayan, lakin real təcrübəsinə uyğun olan potensial uyğunluq (həmişə compatibility-dən böyük və ya bərabər olmalıdır). "realCompatibilityGap" sahəsində bu fərqin səbəbini qısa izah et (məs. CV-də bir bacarıq zəif təsvir olunub, amma kontekstdən real təcrübə göründüyü halda).
- BÜTÜN sərbəst mətn sahələrini ${LANG_NAME[outputLanguage] || 'Azərbaycan'} dilində yaz — heç bir istisna yoxdur. Bura daxildir: compatibilityLabel, criticalGapSummary, mostImportantMissingRequirement, mostImportantMissingExplanation, recommendationStatus, recommendationReasons, recommendationNextAction, realCompatibilityGap, weakPresentation, improvementOpportunities, strengths (title/text/relatedRequirement), categoryScores-də "category" adları, VƏ requirements massivinin İÇİNDƏKİ hər elementin "title", "category", "evidence", "explanation" sahələri — bu daxili massiv sahələri xüsusilə tez-tez unudulur, onlara da eyni qayda tətbiq olunur. YALNIZ bu iki sahənin sabit dəyərləri dəyişməz qalmalıdır (bunlar tərcümə edilmir, kod onlara görə işləyir): "importance" (yalnız kritik/əsas/üstünlük) və "status" (yalnız met/partial/missing/insufficient_info).
- Ton: dəstəkləyici, dürüst, mühakimə etməyən. Zəmanət verən dil işlətmə.`;

  const user = `CV MƏTNİ:\n"""\n${cvText.slice(0, 15000)}\n"""\n\nVAKANSİYA MƏTNİ:\n"""\n${vacancyText.slice(0, 15000)}\n"""\n\nYuxarıdakı CV-ni bu vakansiya ilə müqayisə et və tam strukturlaşdırılmış nəticə qaytar.`;

  const response = await anthropic.messages.create({
    model: ANALYSIS_MODEL,
    // Vacancy text now comes from full-browser rendering (vacancyExtract.ts), which correctly
    // captures JS-rendered job postings but can also pull in a lot of surrounding page noise
    // (category sidebars, "similar postings" widgets) on some sites — that pushed a real response
    // past the previous 8000-token budget, truncating the JSON mid-string and failing the whole
    // analysis. Raised for headroom; if this still truncates on some page, the vacancy text itself
    // needs tighter extraction, not a further bump here.
    max_tokens: 16000,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { format: { type: 'json_schema', schema: matchResultSchema as any } },
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  if (!textBlock) throw new Error('AI cavabında mətn tapılmadı.');
  const result = JSON.parse(textBlock.text) as MatchResult;
  // Downgrades unevidenced 'met' claims, then derives compatibility/categoryScores/requirement
  // counts/criticalGapsCount deterministically from the (corrected) requirements — the
  // authoritative score must be calculated by application logic, not freely generated by AI, and
  // every confirmed match must have valid CV evidence (both product rules). See scoring.ts.
  return applyScoringOverrides(result);
}

function offlineAnalyze(cvText: string, vacancyText: string): MatchResult {
  // Deterministic placeholder used only when no ANTHROPIC_API_KEY is configured,
  // so the rest of the product flow can still be exercised end-to-end.
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
    vacancyTitle: 'Vakansiya',
    vacancyCompanyGuess: 'Naməlum şirkət',
    compatibility,
    compatibilityLabel: compatibility >= 70 ? 'Yaxşı uyğunluq' : compatibility >= 45 ? 'Orta uyğunluq' : 'Zəif uyğunluq',
    realCompatibility: compatibility,
    realCompatibilityGap: 'AI konfiqurasiya olunmayıb — real və görünən uyğunluq fərqi hesablanmayıb.',
    mainRequirementsTotal: 10,
    mainRequirementsMet: Math.round((compatibility / 100) * 7),
    mainRequirementsPartial: 2,
    mainRequirementsMissing: 1,
    criticalGapsCount: 1,
    criticalGapSummary: 'AI konfiqurasiya olunmayıb — bu nümunə göstəricidir.',
    hrScreeningEstimate: Math.max(10, compatibility - 8),
    reliability: 'orta',
    categoryScores: [
      { category: 'İş təcrübəsi', score: compatibility },
      { category: 'Texniki bacarıqlar', score: Math.max(20, compatibility - 15) },
      { category: 'Proqram və alətlər', score: Math.max(20, compatibility - 20) },
      { category: 'Sektor təcrübəsi', score: Math.max(20, compatibility - 5) },
      { category: 'Təhsil', score: 90 },
      { category: 'Dil bilikləri', score: 85 },
      { category: 'İdarəetmə və əməkdaşlıq', score: Math.max(20, compatibility - 10) },
    ],
    requirements: [],
    strengths: [],
    mostImportantMissingRequirement: 'ANTHROPIC_API_KEY konfiqurasiya olunmayıb',
    mostImportantMissingExplanation:
      'Bu server üçün ANTHROPIC_API_KEY mühit dəyişəni təyin edilməyib, ona görə real AI analizi əvəzinə nümunə göstəricilər göstərilir.',
    recommendationStatus: 'CV-ni uyğunlaşdırdıqdan sonra müraciət et',
    recommendationTone: 'warning',
    recommendationReasons: ['Real AI analizi üçün ANTHROPIC_API_KEY tələb olunur.'],
    recommendationNextAction: 'Serverdə ANTHROPIC_API_KEY mühit dəyişənini təyin edin.',
    weakPresentation: [],
    improvementOpportunities: [],
  };
}

// ---------- tailored CV ----------

const cvDataSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    title: { type: 'string' },
    contact: { type: 'string' },
    summary: { type: 'string' },
    skills: { type: 'array', items: { type: 'string' } },
    experience: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          dates: { type: 'string' },
          bullets: { type: 'array', items: { type: 'string' } },
        },
        required: ['role', 'dates', 'bullets'],
        additionalProperties: false,
      },
    },
    education: { type: 'string' },
    certifications: { type: 'string' },
    languages: { type: 'string' },
    changeExplanations: { type: 'array', items: { type: 'string' } },
  },
  required: ['name', 'title', 'contact', 'summary', 'skills', 'experience', 'education', 'certifications', 'languages', 'changeExplanations'],
  additionalProperties: false,
};

export type TailoredCv = {
  name: string;
  title: string;
  contact: string;
  summary: string;
  skills: string[];
  experience: { role: string; dates: string; bullets: string[] }[];
  education: string;
  certifications: string;
  languages: string;
  changeExplanations: string[];
};

export async function generateTailoredCv(
  cvText: string,
  vacancyText: string,
  match: MatchResult,
  outputLanguage: string,
  selfAttestedGap: SelfAttestedGap = null,
): Promise<TailoredCv> {
  const anthropic = getClient();
  if (!anthropic) {
    return {
      name: 'Namizəd',
      title: match.vacancyTitle,
      contact: '',
      summary: 'ANTHROPIC_API_KEY konfiqurasiya olunmayıb.',
      skills: [],
      experience: [],
      education: '',
      certifications: '',
      languages: '',
      changeExplanations: ['AI konfiqurasiya olunmayıb.'],
    };
  }

  const system = `Sən namizədin CV-sini konkret vakansiyaya uyğunlaşdıran köməkçisən. YALNIZ CV-də mövcud olan real təcrübədən istifadə et — heç vaxt olmayan bacarıq və ya nəticə uydurma. Mətni ${LANG_NAME[outputLanguage] || 'Azərbaycan'} dilində yaz. ATS-friendly, sadə, bir sütunlu format üçün strukturlaşdırılmış məzmun hazırla.`;
  const user = `ORİJİNAL CV:\n"""\n${cvText.slice(0, 15000)}\n"""\n\nVAKANSİYA:\n"""\n${vacancyText.slice(0, 8000)}\n"""\n\nUYĞUNLUQ ANALİZİ XÜLASƏSİ: ${JSON.stringify({
    compatibility: match.compatibility,
    requirements: match.requirements.slice(0, 15),
  })}\n\nBu CV-ni vakansiyaya uyğunlaşdır: professional summary-ni yenidən yaz, iş təcrübəsi bəndlərini vakansiyanın dilinə uyğun formalaşdır, skills bölməsini prioritetləşdir. changeExplanations sahəsində 3-5 qısa dəyişiklik izahı ver.${selfAttestPromptNote(selfAttestedGap)}`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 6000,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { format: { type: 'json_schema', schema: cvDataSchema as any } },
  });
  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  if (!textBlock) throw new Error('AI cavabında mətn tapılmadı.');
  return JSON.parse(textBlock.text) as TailoredCv;
}

// ---------- cover letter ----------

const coverLetterSchema = {
  type: 'object',
  properties: {
    greeting: { type: 'string' },
    body: { type: 'array', items: { type: 'string' } },
    closing: { type: 'string' },
    basedOn: { type: 'array', items: { type: 'string' } },
  },
  required: ['greeting', 'body', 'closing', 'basedOn'],
  additionalProperties: false,
};

export type CoverLetter = { greeting: string; body: string[]; closing: string; basedOn: string[] };

export async function generateCoverLetter(
  cvText: string,
  vacancyText: string,
  match: MatchResult,
  outputLanguage: string,
): Promise<CoverLetter> {
  const anthropic = getClient();
  if (!anthropic) {
    return {
      greeting: 'Hörmətli işə qəbul üzrə mütəxəssis,',
      body: ['ANTHROPIC_API_KEY konfiqurasiya olunmayıb.'],
      closing: 'Hörmətlə,',
      basedOn: [],
    };
  }
  const system = `Sən namizəd üçün konkret vakansiyaya uyğun, sübuta əsaslanan cover letter yazan köməkçisən. YALNIZ CV-də olan real təcrübədən istifadə et. Mətni ${LANG_NAME[outputLanguage] || 'Azərbaycan'} dilində, peşəkar tonda yaz. 2-3 qısa paraqraf kifayətdir.`;
  const user = `CV:\n"""\n${cvText.slice(0, 12000)}\n"""\n\nVAKANSİYA:\n"""\n${vacancyText.slice(0, 8000)}\n"""\n\nGüclü tərəflər: ${JSON.stringify(match.strengths)}\n\nCover letter hazırla. basedOn sahəsində məktubun əsaslandığı 3-4 konkret təcrübəni sadala.`;
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { format: { type: 'json_schema', schema: coverLetterSchema as any } },
  });
  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  if (!textBlock) throw new Error('AI cavabında mətn tapılmadı.');
  return JSON.parse(textBlock.text) as CoverLetter;
}

// ---------- interview prep ----------

const interviewSchema = {
  type: 'object',
  properties: {
    strongestTopic: { type: 'string' },
    biggestRisk: { type: 'string' },
    tellMeAboutYourself: { type: 'string' },
    hrQuestions: { type: 'array', items: questionItem() },
    situational: { type: 'array', items: questionItem() },
    technical: { type: 'array', items: questionItem() },
    gapExplanations: { type: 'array', items: { type: 'string' } },
    questionsToAsk: { type: 'array', items: { type: 'string' } },
  },
  required: ['strongestTopic', 'biggestRisk', 'tellMeAboutYourself', 'hrQuestions', 'situational', 'technical', 'gapExplanations', 'questionsToAsk'],
  additionalProperties: false,
};
function questionItem() {
  return {
    type: 'object',
    properties: {
      question: { type: 'string' },
      why: { type: 'string' },
      answerFramework: { type: 'string' },
    },
    required: ['question', 'why', 'answerFramework'],
    additionalProperties: false,
  } as const;
}

export type InterviewPrep = {
  strongestTopic: string;
  biggestRisk: string;
  tellMeAboutYourself: string;
  hrQuestions: { question: string; why: string; answerFramework: string }[];
  situational: { question: string; why: string; answerFramework: string }[];
  technical: { question: string; why: string; answerFramework: string }[];
  gapExplanations: string[];
  questionsToAsk: string[];
};

export async function generateInterviewPrep(
  cvText: string,
  vacancyText: string,
  match: MatchResult,
  outputLanguage: string,
  selfAttestedGap: SelfAttestedGap = null,
): Promise<InterviewPrep> {
  const anthropic = getClient();
  if (!anthropic) {
    return {
      strongestTopic: '—',
      biggestRisk: '—',
      tellMeAboutYourself: 'ANTHROPIC_API_KEY konfiqurasiya olunmayıb.',
      hrQuestions: [],
      situational: [],
      technical: [],
      gapExplanations: [],
      questionsToAsk: [],
    };
  }
  const system = `Sən namizədi müsahibəyə hazırlayan köməkçisən. Suallar vakansiyaya və CV-yə əsaslanmalıdır. Olmayan təcrübəni uydurma — boşluqlar üçün namizədə açıq və dürüst cavab istiqaməti ver. BÜTÜN mətn sahələrini ${LANG_NAME[outputLanguage] || 'Azərbaycan'} dilində yaz — heç bir istisna yoxdur, bura hrQuestions/situational/technical massivlərinin İÇİNDƏKİ hər elementin "question", "why" və "answerFramework" sahələri də daxildir (bu daxili massiv sahələri xüsusilə tez-tez unudulur).`;
  const user = `CV:\n"""\n${cvText.slice(0, 12000)}\n"""\n\nVAKANSİYA:\n"""\n${vacancyText.slice(0, 8000)}\n"""\n\nUYĞUNLUQ ANALİZİ: ${JSON.stringify({
    requirements: match.requirements.slice(0, 15),
    strengths: match.strengths,
  })}\n\n3-4 HR sualı, 3-4 situasiya sualı, 3-4 texniki sual, "Tell me about yourself" cavabı, kritik boşluqların izahı və müsahibəçiyə veriləcək 3-4 sual hazırla.${selfAttestPromptNote(selfAttestedGap)}`;
  const response = await anthropic.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 6000,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { format: { type: 'json_schema', schema: interviewSchema as any } },
  });
  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  if (!textBlock) throw new Error('AI cavabında mətn tapılmadı.');
  return JSON.parse(textBlock.text) as InterviewPrep;
}
