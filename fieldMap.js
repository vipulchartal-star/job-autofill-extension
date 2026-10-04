// Shared field dictionary: used by content.js (to detect+fill) and popup.js (to render the profile form).
// Each entry: profile key -> { label, type, keywords[], group }
// type: 'text' | 'textarea' | 'boolean'
// group: used only by popup.js to organize the form into collapsible sections.
// keywords matched against a normalized signal built from name/id/placeholder/aria-label/label text.

const FIELD_GROUPS = [
  { id: 'basic', label: 'Basic info', open: true },
  { id: 'links', label: 'Links' },
  { id: 'work', label: 'Work' },
  { id: 'address', label: 'Address' },
  { id: 'education', label: 'Education' },
  { id: 'written', label: 'Summary & letters' },
  { id: 'questions', label: 'Common questions' },
  { id: 'files', label: 'Files' },
];

const FIELD_DEFS = [
  { key: 'firstName', label: 'First name', type: 'text', group: 'basic',
    keywords: ['firstname', 'first name', 'fname', 'givenname', 'given name'] },
  { key: 'lastName', label: 'Last name', type: 'text', group: 'basic',
    keywords: ['lastname', 'last name', 'lname', 'surname', 'familyname', 'family name'] },
  { key: 'fullName', label: 'Full name', type: 'text', group: 'basic',
    keywords: ['fullname', 'full name', 'yourname', 'your name', 'legalname', 'candidatename'] },
  { key: 'email', label: 'Email', type: 'text', group: 'basic',
    keywords: ['email', 'e-mail', 'emailaddress'] },
  { key: 'phone', label: 'Phone', type: 'text', group: 'basic',
    keywords: ['phone', 'mobile', 'cell', 'telephone', 'contactnumber', 'phonenumber'] },
  { key: 'addressLine1', label: 'Address line 1', type: 'text', group: 'address',
    keywords: ['address1', 'addressline1', 'streetaddress', 'street address', 'address'] },
  { key: 'addressLine2', label: 'Address line 2', type: 'text', group: 'address',
    keywords: ['address2', 'addressline2', 'apt', 'suite', 'unit'] },
  { key: 'city', label: 'City', type: 'text', group: 'address', keywords: ['city', 'town'] },
  { key: 'state', label: 'State / Province', type: 'text', group: 'address', keywords: ['state', 'province', 'region'] },
  { key: 'zip', label: 'Zip / Postal code', type: 'text', group: 'address', keywords: ['zip', 'postal', 'postcode'] },
  { key: 'country', label: 'Country', type: 'text', group: 'address', keywords: ['country', 'nation'] },
  { key: 'linkedin', label: 'LinkedIn URL', type: 'text', group: 'links', keywords: ['linkedin'] },
  { key: 'github', label: 'GitHub URL', type: 'text', group: 'links', keywords: ['github'] },
  { key: 'portfolio', label: 'Portfolio / Website', type: 'text', group: 'links',
    keywords: ['portfolio', 'website', 'personalsite', 'personal site'] },
  { key: 'currentCompany', label: 'Current company', type: 'text', group: 'work',
    keywords: ['currentcompany', 'current company', 'employer', 'company'] },
  { key: 'currentTitle', label: 'Current job title', type: 'text', group: 'work',
    keywords: ['currenttitle', 'jobtitle', 'job title', 'currentposition', 'position', 'role'] },
  { key: 'yearsExperience', label: 'Years of experience', type: 'text', group: 'work',
    keywords: ['yearsofexperience', 'years of experience', 'experience', 'yearsexperience'] },
  { key: 'desiredSalary', label: 'Desired salary', type: 'text', group: 'work',
    keywords: ['desiredsalary', 'expectedsalary', 'salaryexpectation', 'salary'] },
  { key: 'noticePeriod', label: 'Notice period', type: 'text', group: 'work',
    keywords: ['noticeperiod', 'notice period', 'availability', 'startdate', 'start date'] },
  { key: 'school', label: 'School / University', type: 'text', group: 'education',
    keywords: ['school', 'university', 'college', 'institution'] },
  { key: 'degree', label: 'Degree', type: 'text', group: 'education', keywords: ['degree', 'qualification'] },
  { key: 'fieldOfStudy', label: 'Field of study', type: 'text', group: 'education',
    keywords: ['fieldofstudy', 'field of study', 'major', 'discipline'] },
  { key: 'graduationYear', label: 'Graduation year', type: 'text', group: 'education',
    keywords: ['graduationyear', 'graduation year', 'gradyear'] },
  { key: 'summary', label: 'Summary / About', type: 'textarea', group: 'written',
    keywords: ['summary', 'aboutyou', 'about you', 'bio', 'profilesummary'] },
  { key: 'coverLetter', label: 'Cover letter', type: 'textarea', group: 'written',
    keywords: ['coverletter', 'cover letter', 'motivationletter', 'whyareyouinterested', 'why do you want'] },
  { key: 'resumeText', label: 'Resume (plain text, for paste-resume fallback fields)', type: 'textarea', group: 'written',
    keywords: ['resumetext', 'pasteresume', 'resume'] },
  { key: 'howHeard', label: 'How did you hear about us', type: 'text', group: 'questions',
    keywords: ['howdidyouhear', 'how did you hear', 'referral', 'referredby', 'source'] },
  { key: 'workAuthorized', label: 'Authorized to work (yes/no)', type: 'boolean', group: 'questions',
    keywords: ['authorizedtowork', 'legallyauthorized', 'work authorization', 'eligibletowork'] },
  { key: 'needSponsorship', label: 'Need visa sponsorship (yes/no)', type: 'boolean', group: 'questions',
    keywords: ['sponsorship', 'requiresponsorship', 'visasponsorship', 'need sponsorship'] },
  { key: 'willingToRelocate', label: 'Willing to relocate (yes/no)', type: 'boolean', group: 'questions',
    keywords: ['relocate', 'willingtorelocate', 'relocation'] },
  // No keywords on purpose: never auto-selected by the generic keyword matcher — content.js
  // reads this directly for actual <input type=file> resume-upload fields (see ATTACH_FILE).
  { key: 'resumeFilePath', label: 'Resume file path (absolute, desktop Chrome only)', type: 'text', group: 'files',
    keywords: [] },
];

// Deliberately excluded: gender, race/ethnicity, disability, veteran status (EEO/voluntary
// self-ID fields) — too sensitive to auto-answer; left for the applicant to fill by hand.

if (typeof module !== 'undefined') module.exports = { FIELD_DEFS, FIELD_GROUPS };
