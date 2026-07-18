import { useNavigate } from 'react-router-dom';
import { MarketingHeader, Footer } from '../components/MarketingChrome';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { LEGAL_CONTENT, type LegalDoc } from '../lib/legalContent';

type DocKey = 'privacy' | 'terms' | 'deletion';

export default function LegalPage({ docKey }: { docKey: DocKey }) {
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const content = LEGAL_CONTENT[lang];
  const doc: LegalDoc = content[docKey];

  const tabs: { key: DocKey; label: string; path: string }[] = [
    { key: 'privacy', label: t.footer.privacy, path: '/privacy' },
    { key: 'terms', label: t.footer.terms, path: '/terms' },
    { key: 'deletion', label: t.footer.dataDelete, path: '/deletion' },
  ];

  return (
    <div>
      <MarketingHeader />
      <div className="max-w-[760px] mx-auto px-6 py-12">
        <div className="flex gap-2 flex-wrap mb-8">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => navigate(tb.path)}
              className={
                'px-3.5 py-2 rounded-full text-[13px] font-semibold border focus-ring ' +
                (docKey === tb.key ? 'border-teal bg-success-bg text-teal' : 'border-border text-text2 bg-white')
              }
            >
              {tb.label}
            </button>
          ))}
        </div>
        <h1 className="text-[26px] font-bold mb-1.5">{doc.title}</h1>
        <p className="text-[13px] text-muted mb-8">{content.updated}</p>
        <div className="grid gap-8">
          {doc.sections.map(([heading, paragraphs], i) => (
            <div key={i}>
              <h2 className="text-[17px] font-bold mb-3">{heading}</h2>
              <div className="grid gap-1.5">
                {paragraphs.map((p, j) => (
                  <p key={j} className="text-[14.5px] leading-relaxed text-text2">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
