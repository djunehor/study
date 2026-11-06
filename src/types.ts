export interface PhDPosition {
  id: string;
  title: string;
  employer: string;
  location: string;
  postalCode?: string;
  state: string;
  isWestGermany: boolean;
  publicationDate: string;
  applicationWindow?: string;
  deadline: string;
  link: string;
  matchedKeywords: string[];
  isEnglishPreferred: boolean;
  description: string;
  source: string;
  opportunityType?: 'Live Vacancy' | 'Structured PhD Program';
  verificationStatus?: 'Verified Match' | 'Conditional Match' | 'Rejected' | 'Unverified';
  matchScore?: number;
  degreeFit?: string;
  languageRequirement?: string;
  compensation?: string;
  aiSummary?: string;
  evaluatedBy?: 'Gemini AI' | 'Rule Engine';
}

export interface ScanStats {
  totalRawScanned: number;
  verifiedLiveCount: number;
  structuredProgramCount: number;
  rejectedCount: number;
  evaluatedBy: 'Gemini AI' | 'Deep Page Inspector';
  timestamp: string;
}

export interface FilterOptions {
  query?: string;
  onlyWestGermany?: boolean;
  onlyEnglish?: boolean;
  state?: string;
}

export interface UniversityUrl {
  label: string;
  url: string;
}

export interface UniversityEntry {
  id: number;
  name: string;
  rawTitle: string;
  location: string;
  state: string;
  pathway: 'Structured (100% English)' | 'Individual Promotion';
  program: string;
  fields: string[];
  languagePolicy: string;
  funding: string;
  applicationWindow?: string;
  deadline?: string;
  verifiedProfessorsSummary: string;
  urls: UniversityUrl[];
}

export interface UniversityFilterOptions {
  search?: string;
  state?: string;
  pathway?: string;
  field?: string;
}

export interface EnglishJobEntry {
  jobId: string;
  isMatch?: boolean;
  jobTitle: string;
  employer: string;
  workplaceLocation: string;
  category: string;
  fitAssessment: string;
  directApplicationLink: string;
}

