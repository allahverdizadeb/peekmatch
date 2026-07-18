import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Check, Link as LinkIcon, AlertTriangle, Loader2 } from 'lucide-react';
import { MarketingHeader, Footer } from '../components/MarketingChrome';
import { Button } from '../components/ui';
import {
  createAnalysisFromFile,
  createAnalysisFromText,
  checkVacancyUrl,
  submitVacancyText,
  updateSettings,
  startAnalysis,
  type VacancyPreview,
} from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { Lang } from '../lib/i18n/locales';

const MIN_CV_TEXT = 2000;
const MIN_VACANCY_TEXT = 3000;

const SAMPLE_CV =
  'Biznes analitik, 5 il təcrübə. Operational reporting, stakeholder coordination, process monitoring. SQL və Excel ilə hesabatların hazırlanması, şöbələrarası koordinasiya, proses təkmilləşdirmə layihələri. Bakı Dövlət Universiteti, İqtisadiyyat. Azərbaycan, ingilis və rus dilləri. '.repeat(
    12,
  );
const SAMPLE_VACANCY =
  'Business Analyst vəzifəsi üçün əsas tələblər: operational reporting, stakeholder coordination, Power BI, SQL, Agile mühiti, maliyyə sektoru təcrübəsi, proseslərin təkmilləşdirilməsi. Namizəd data visualization və requirement analysis üzrə təcrübəyə malik olmalıdır. '.repeat(
    12,
  );

export default function AnalysisForm() {
  const navigate = useNavigate();
  const { t, lang: uiLang } = useLanguage();
  const fileInput = useRef<HTMLInputElement>(null);

  const [analysisId, setAnalysisId] = useState<string | null>(null);

  const [cvMode, setCvMode] = useState<'file' | 'text'>('file');
  const [dragOver, setDragOver] = useState(false);
  const [cvUploading, setCvUploading] = useState(false);
  const [cvName, setCvName] = useState('');
  const [cvSize, setCvSize] = useState('');
  const [cvError, setCvError] = useState('');
  const [cvText, setCvText] = useState('');
  const [cvUploaded, setCvUploaded] = useState(false);

  const [vacancyUrl, setVacancyUrl] = useState('');
  const [vacancyChecking, setVacancyChecking] = useState(false);
  const [vacancyStatus, setVacancyStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [vacancyPreview, setVacancyPreview] = useState<VacancyPreview | null>(null);
  const [vacancyFailReason, setVacancyFailReason] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualText, setManualText] = useState('');
  const [manualSubmitted, setManualSubmitted] = useState(false);

  const [outputLanguage, setOutputLanguage] = useState<Lang>(uiLang);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const vacancyReady = vacancyStatus === 'success' || (manualMode && manualSubmitted);
  const canSubmit = cvUploaded && vacancyReady && consent && !submitting;

  async function handleFile(file: File) {
    setCvError('');
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setCvError(t.analysisForm.errUnsupportedType);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setCvError(t.analysisForm.errFileTooLarge);
      return;
    }
    setCvUploading(true);
    try {
      const res = await createAnalysisFromFile(file);
      setAnalysisId(res.id);
      setCvName(res.cvName);
      setCvSize(res.cvSize);
      setCvUploaded(true);
    } catch (err: any) {
      setCvError(err.message || t.analysisForm.errFileUploadGeneric);
    } finally {
      setCvUploading(false);
    }
  }

  async function submitCvText() {
    setCvError('');
    setCvUploading(true);
    try {
      const res = await createAnalysisFromText(cvText);
      setAnalysisId(res.id);
      setCvName(res.cvName);
      setCvSize(res.cvSize);
      setCvUploaded(true);
    } catch (err: any) {
      setCvError(err.message || t.analysisForm.errCvTextRejected);
    } finally {
      setCvUploading(false);
    }
  }

  function resetCv() {
    setCvUploaded(false);
    setCvName('');
    setCvSize('');
    setCvText('');
    setAnalysisId(null);
    setVacancyStatus('idle');
    setVacancyPreview(null);
    setManualMode(false);
    setManualSubmitted(false);
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [analysisId],
  );

  async function checkVacancy() {
    if (!analysisId) return;
    setVacancyChecking(true);
    setVacancyStatus('idle');
    setVacancyFailReason('');
    try {
      const res = await checkVacancyUrl(analysisId, vacancyUrl);
      if (res.status === 'success' && res.vacancy) {
        setVacancyPreview(res.vacancy);
        setVacancyStatus('success');
        setManualMode(false);
      } else {
        setVacancyStatus('failed');
        setVacancyFailReason(res.reason || t.analysisForm.errVacancyGeneric);
        setManualMode(true);
      }
    } catch (err: any) {
      setVacancyStatus('failed');
      setVacancyFailReason(err.message || t.analysisForm.errVacancyAutoFail);
      setManualMode(true);
    } finally {
      setVacancyChecking(false);
    }
  }

  async function submitManualVacancy() {
    if (!analysisId) return;
    try {
      await submitVacancyText(analysisId, manualText);
      setManualSubmitted(true);
    } catch (err: any) {
      setSubmitError(err.message);
    }
  }

  async function handleSubmit() {
    if (!analysisId) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await updateSettings(analysisId, { outputLanguage, consent });
      await startAnalysis(analysisId);
      navigate(`/processing/${analysisId}`);
    } catch (err: any) {
      setSubmitError(err.message || t.analysisForm.errSubmitGeneric);
      setSubmitting(false);
    }
  }

  return (
    <div>
      <MarketingHeader />
      <div className="max-w-[760px] mx-auto px-6 py-12">
        <div className="bg-surface border border-border rounded-rl shadow-sh p-7 md:p-9">
          <h1 className="text-[24px] font-bold mb-1.5">{t.analysisForm.title}</h1>
          <p className="text-[15px] text-text2 mb-8">{t.analysisForm.subtitle}</p>

          {/* Step 1: CV */}
          <div className="mb-8">
            <label className="block text-[15px] font-semibold mb-3">{t.analysisForm.step1Label}</label>
            {!cvUploaded && (
              <div className="flex gap-1.5 mb-3">
                {(['file', 'text'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setCvMode(m)}
                    className={
                      'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold border focus-ring ' +
                      (cvMode === m ? 'border-teal bg-success-bg text-teal' : 'border-border text-text2 bg-white')
                    }
                  >
                    {m === 'file' ? <Upload className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                    {m === 'file' ? t.analysisForm.modeFile : t.analysisForm.modeText}
                  </button>
                ))}
              </div>
            )}

            {cvUploaded ? (
              <div className="flex items-center gap-3 border border-border rounded-rk p-4 bg-bg">
                <FileText className="w-6 h-6 text-teal flex-none" />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold truncate">{cvName}</div>
                  <div className="text-[12px] text-text2 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-success" />
                    {cvSize} · {t.analysisForm.uploadedSuccess}
                  </div>
                </div>
                <button onClick={resetCv} className="text-[13px] font-semibold text-teal hover:text-teal-h flex-none">
                  {t.common.change}
                </button>
              </div>
            ) : cvMode === 'file' ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={
                  'border-[1.5px] border-dashed rounded-rc p-8 text-center transition-colors ' +
                  (dragOver ? 'border-teal bg-success-bg/40' : 'border-border bg-bg')
                }
              >
                {cvUploading ? (
                  <div className="flex flex-col items-center gap-2 text-text2">
                    <Loader2 className="w-6 h-6 animate-spin text-teal" />
                    <span className="text-[14px]">{t.common.loading}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-7 h-7 text-teal mx-auto mb-3" />
                    <p className="text-[15px] font-medium mb-1">{t.analysisForm.dropTitle}</p>
                    <p className="text-[13.5px] text-text2 mb-4">{t.analysisForm.dropSubtitle}</p>
                    <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
                      {t.analysisForm.chooseFile}
                    </Button>
                    <input
                      ref={fileInput}
                      type="file"
                      accept=".pdf,.docx"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    />
                    <div className="flex justify-center gap-2 mt-4 text-[11px] text-muted">
                      <span className="px-2 py-0.5 rounded-full bg-bg2">PDF</span>
                      <span className="px-2 py-0.5 rounded-full bg-bg2">DOCX</span>
                      <span>{t.analysisForm.maxFileSize}</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div>
                <textarea
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                  placeholder={t.analysisForm.textPlaceholder}
                  className="w-full min-h-[160px] border border-border rounded-rk p-3 text-[14px] resize-y focus-ring"
                />
                <div className="flex justify-between items-center flex-wrap gap-2 mt-1.5">
                  <span className={'text-[12px] font-semibold ' + (cvText.length >= MIN_CV_TEXT ? 'text-success' : 'text-muted')}>
                    {t.analysisForm.minCharsPrefix} {MIN_CV_TEXT} {t.analysisForm.minCharsUnit} · {cvText.length} / {MIN_CV_TEXT}
                  </span>
                  {cvText.length >= MIN_CV_TEXT ? (
                    <Button size="sm" loading={cvUploading} onClick={submitCvText}>
                      {t.analysisForm.submitCvText}
                    </Button>
                  ) : (
                    <button className="text-[12px] font-semibold text-teal" onClick={() => setCvText(SAMPLE_CV)}>
                      {t.analysisForm.fillSample}
                    </button>
                  )}
                </div>
              </div>
            )}
            {cvError && <p className="text-[13px] text-danger mt-2">{cvError}</p>}
          </div>

          {/* Step 2: vacancy */}
          <div className="mb-8">
            <label className="block text-[15px] font-semibold mb-3">{t.analysisForm.step2Label}</label>
            {vacancyStatus === 'success' && vacancyPreview ? (
              <div className="border border-border rounded-rk p-4 bg-bg">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success flex-none mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold truncate">{vacancyPreview.title}</div>
                    <div className="text-[12.5px] text-text2 truncate">
                      {vacancyPreview.company} {vacancyPreview.location ? `· ${vacancyPreview.location}` : ''} · {vacancyPreview.domain}
                    </div>
                    <span className="inline-block mt-1.5 text-[11px] font-semibold text-success">{t.analysisForm.vacancyFound}</span>
                  </div>
                  <button
                    className="text-[13px] font-semibold text-teal flex-none"
                    onClick={() => {
                      setVacancyStatus('idle');
                      setVacancyPreview(null);
                    }}
                    disabled={!analysisId}
                  >
                    {t.common.change}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={vacancyUrl}
                    onChange={(e) => setVacancyUrl(e.target.value)}
                    placeholder={t.analysisForm.vacancyUrlPlaceholder}
                    disabled={!analysisId}
                    className="flex-1 min-w-0 border border-border rounded-rk px-3.5 py-2.5 text-[14px] focus-ring disabled:bg-bg2"
                  />
                  <Button size="sm" loading={vacancyChecking} disabled={!analysisId || !vacancyUrl} onClick={checkVacancy} className="sm:flex-none">
                    <LinkIcon className="w-4 h-4" />
                    {t.analysisForm.checkVacancy}
                  </Button>
                </div>
                <p className="text-[13px] text-text2 mt-1.5">
                  {analysisId ? t.analysisForm.vacancyHintReady : t.analysisForm.vacancyHintNotReady}
                </p>
                {vacancyChecking && <p className="text-[13px] text-teal mt-1">{t.analysisForm.vacancyChecking}</p>}
              </>
            )}

            {vacancyStatus === 'failed' && !manualSubmitted && (
              <div className="mt-4 border border-border rounded-rc p-4 bg-warning-bg">
                <div className="flex items-start gap-2.5 mb-3">
                  <AlertTriangle className="w-5 h-5 text-warning flex-none mt-0.5" />
                  <div>
                    <div className="text-[14.5px] font-semibold">{t.analysisForm.vacancyFailTitle}</div>
                    <p className="text-[13px] text-text2 mt-0.5">
                      {vacancyFailReason || t.analysisForm.vacancyFailFallbackSite} {t.analysisForm.vacancyFailInstruction}
                    </p>
                  </div>
                </div>
                <label className="block text-[13px] font-semibold mb-1.5">{t.analysisForm.manualLabel}</label>
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder={t.analysisForm.manualPlaceholder}
                  className="w-full min-h-[140px] border border-border rounded-rk p-3 text-[14px] resize-y focus-ring bg-white"
                />
                <div className="flex justify-between items-center flex-wrap gap-2 mt-1.5">
                  <span className={'text-[12px] font-semibold ' + (manualText.length >= MIN_VACANCY_TEXT ? 'text-success' : 'text-muted')}>
                    {t.analysisForm.minCharsPrefix} {MIN_VACANCY_TEXT} {t.analysisForm.minCharsUnit} · {manualText.length} / {MIN_VACANCY_TEXT}
                  </span>
                  {manualText.length >= MIN_VACANCY_TEXT ? (
                    <Button size="sm" onClick={submitManualVacancy}>{t.analysisForm.submitManual}</Button>
                  ) : (
                    <button className="text-[12px] font-semibold text-teal" onClick={() => setManualText(SAMPLE_VACANCY)}>
                      {t.analysisForm.fillSample}
                    </button>
                  )}
                </div>
              </div>
            )}

            {manualSubmitted && (
              <div className="mt-4 flex items-center gap-2.5 border border-border rounded-rk p-4 bg-bg">
                <Check className="w-5 h-5 text-success flex-none" />
                <span className="text-[14px] font-medium">{t.analysisForm.manualSubmittedText}</span>
                <button
                  className="ml-auto text-[13px] font-semibold text-teal"
                  onClick={() => {
                    setManualSubmitted(false);
                    setVacancyStatus('idle');
                  }}
                >
                  {t.common.change}
                </button>
              </div>
            )}
          </div>

          {/* Step 3: language */}
          <div className="mb-8">
            <label className="block text-[15px] font-semibold mb-3">{t.analysisForm.step3Label}</label>
            <div className="flex gap-2">
              {(['az', 'en', 'tr', 'ru'] as const).map((code) => (
                <button
                  key={code}
                  onClick={() => setOutputLanguage(code)}
                  className={
                    'px-3.5 py-2 rounded-full text-[13.5px] font-semibold border focus-ring ' +
                    (outputLanguage === code ? 'border-teal bg-success-bg text-teal' : 'border-border text-text2 bg-white')
                  }
                >
                  {t.analysisForm.languagePills[code]}
                </button>
              ))}
            </div>
          </div>

          {/* Step 4: consent */}
          <label className="flex items-start gap-3 mb-6 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 w-4 h-4 accent-teal"
            />
            <span className="text-[13.5px] text-text2 leading-relaxed">
              {t.analysisForm.consentText}
            </span>
          </label>

          {submitError && <p className="text-[13.5px] text-danger mb-3">{submitError}</p>}

          <Button className="w-full" size="md" disabled={!canSubmit} loading={submitting} onClick={handleSubmit}>
            {t.analysisForm.submitCta}
          </Button>
          <p className="text-center text-[12.5px] text-muted mt-2.5">
            {canSubmit ? t.analysisForm.submitHintReady : t.analysisForm.submitHintNotReady}
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
