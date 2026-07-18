import type { LegalContent } from './az';

const M = 'support@peeky.az';

export const en: LegalContent = {
  updated: 'Last updated: July 14, 2026',
  privacy: {
    title: 'Privacy Policy',
    sections: [
      ['1. General', ['PeekMatch is an AI-based CV–vacancy matching service provided by Peeky.', 'This Privacy Policy explains how your data is collected, used, stored and deleted when you use the PeekMatch platform.', 'For all privacy questions: ' + M]],
      ['2. What data do we collect?', ['When you use the platform, the following data may be processed:', '• your uploaded CV and its contents;', '• the vacancy URL or vacancy text you enter;', '• your chosen result language;', '• match results and generated documents;', '• anonymous session and technical security data;', '• selected package, order amount and payment status;', '• support requests you send us.', 'PeekMatch never sees or stores your full card number, CVV or expiry date. Card data is processed directly by the payment provider.']],
      ['3. How do we use the data?', ['Your data is used only to:', '• compare the CV and the vacancy;', '• identify key requirements and critical gaps;', '• calculate match indicators;', '• prepare strengths and an application recommendation;', '• generate a tailored CV, cover letter and interview materials;', '• confirm payment and activate the purchased package;', '• protect platform security;', '• detect technical errors and abuse;', '• respond to user requests.', 'PeekMatch does not sell your personal data or use it for advertising.']],
      ['4. AI analysis', ['PeekMatch uses AI and rule-based systems to compare the CV and the vacancy.', 'Name, photo, age, gender, marital status, religious views and other protected characteristics must not be taken into account when calculating the match.', 'The platform uses only information that is in the CV or confirmed by the user. Experience, certificates or skills not in the CV must not be fabricated.', 'The "HR interview likelihood" is only an approximate screening indicator, not a hiring guarantee.']],
      ['5. Data sharing', ['Data may be processed with the following provider categories only when necessary to deliver the service:', '• cloud and data-storage providers;', '• AI service providers;', '• web hosting and security services;', '• payment providers;', '• state authorities where legally required.', 'CVs and analysis results are not visible to other users and are never published via public links.']],
      ['6. Retention and deletion', ['The CV, vacancy text, analysis results and generated documents are automatically deleted within a maximum of 24 hours.', 'You can delete your data earlier via the "Delete my data" function.', 'Minimal transaction records required by law may be kept longer, separately from CV content.']],
      ['7. Your rights', ['Under applicable law you may have the right to:', '• be informed about your data;', '• request access;', '• request correction of inaccurate data;', '• request deletion;', '• withdraw consent;', '• object to processing;', '• request an explanation of an AI result.', 'To exercise these rights, contact ' + M + '.']],
      ['8. Changes', ['This policy may be updated as the product, technology or legal requirements change. Significant changes will be shown on the platform.']],
    ],
  },
  terms: {
    title: 'Terms of Use',
    sections: [
      ['1. Acceptance of terms', ['PeekMatch is an AI-based career service provided by Peeky.', 'By using PeekMatch you accept these Terms of Use and the Privacy Policy.', 'Questions: ' + M]],
      ['2. Service description', ['PeekMatch may provide:', '• CV–vacancy match analysis;', '• a candidate match indicator;', '• key-requirement comparison and critical gaps;', '• strengths and an application recommendation;', '• a detailed compatibility report;', '• a vacancy-tailored CV and cover letter;', '• interview preparation materials;', '• PDF and DOCX documents.', 'Some features are free; others are paid.']],
      ['3. Limitations of AI results', ['PeekMatch results are AI-based information and recommendations.', 'The platform:', '• does not guarantee an interview invitation;', '• does not guarantee a job offer;', "• does not predetermine the employer's real decision;", '• does not act as a recruiter or official hiring body.', "Checking generated documents before sending them to an employer is the user's responsibility."]],
      ['4. User responsibility', ['You are responsible for the accuracy of the data you upload.', 'The user must:', '• not present fake work experience;', '• not add non-existent skills or certificates;', "• not use third parties' data without permission;", '• check generated documents before sending.']],
      ['5. Payments', ['Paid packages are one-time services and do not create automatic subscriptions.', 'A paid feature is activated only after the payment provider confirms the transaction and the payment is verified server-side.', 'Peeky does not store full card details.']],
      ['6. Refunds', ['A refund may be considered when:', '• a duplicate charge was taken for the same order;', '• the package was not activated despite completed payment;', '• paid material was not generated due to a technical error;', '• the delivered file is technically unusable.', 'A lower-than-expected match percentage does not by itself guarantee a refund.', 'Refund requests: ' + M]],
      ['7. Prohibited use', ['The following are prohibited:', "• uploading someone else's CV without permission;", '• creating fake documents or work experience;', '• using the platform for discrimination;', '• bypassing payment and security mechanisms;', '• unauthorized bots, scraping or automation;', '• uploading malicious files or code.']],
      ['8. Intellectual property', ['The CV and personal data you upload belong to you.', "The platform's software, design, logo, brand elements and analytical methods belong to Peeky."]],
      ['9. Availability and liability', ['Peeky does not guarantee uninterrupted, error-free operation.', 'To the extent permitted by law, Peeky is not liable for employer decisions, absence of interview invitations, or inaccurate data sent unchecked by the user.']],
      ['10. Governing law', ['Unless otherwise required by law, these terms are governed by the laws of the Republic of Azerbaijan.']],
    ],
  },
  deletion: {
    title: 'Data Deletion',
    sections: [
      ['Automatic deletion', ['The following data is automatically deleted within a maximum of 24 hours after the analysis is created:', '• the original CV file and extracted text;', '• the vacancy URL and text;', '• the match analysis, strengths and critical gaps;', '• the tailored CV and cover letter;', '• interview preparation materials;', '• generated PDF and DOCX files.']],
      ['Delete data immediately', ['Select "Delete my data" on the results page to start deletion immediately.', 'After deletion is confirmed:', '• the analysis page will no longer open;', '• document download links will stop working;', '• deleted CVs and results cannot be restored.']],
      ['Deletion request by email', ['If you no longer have access to the results page, contact ' + M + '.', 'Do not send your full card number, CVV or a full copy of your ID by email.']],
      ['Minimal records not deleted', ['Some minimal payment records may be kept for the legally required period for tax, accounting, chargeback and fraud-prevention purposes.', 'Where possible, these records are stored separately from CV and analysis content.']],
      ['Contact', ['For all data-deletion and privacy requests: ' + M]],
    ],
  },
};
