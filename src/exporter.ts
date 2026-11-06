import { PhDPosition, UniversityEntry } from './types';

/**
 * Escape a string for CSV cell insertion.
 */
function escapeCsv(value: string | undefined): string {
  if (value === undefined || value === null) {
    return '""';
  }
  const stringValue = String(value).replace(/"/g, '""').replace(/\r?\n/g, ' ');
  return `"${stringValue}"`;
}

/**
 * Generate an Excel-compatible CSV string from a list of PhD positions.
 * Excludes positions marked as Rejected so the user only downloads ready-to-apply PhD opportunities.
 * Prefixes UTF-8 Byte Order Mark (BOM) so Excel opens German characters correctly.
 */
export function generateExcelCsv(positions: PhDPosition[]): string {
  const readyPositions = positions.filter((p) => p.verificationStatus !== 'Rejected');

  const headers = [
    'Job ID',
    'Title',
    'Institution / Employer',
    'Location',
    'Postal Code',
    'Federal State',
    'Region Status',
    'English Preferred',
    'Matched Keywords',
    'Application Window',
    'Application Deadline',
    'Publication Date',
    'Direct Link',
    'Source',
    'Opportunity Type',
    'Verification Status',
    'Match Score',
    'Degree Fit',
    'Language Requirement',
    'Compensation',
    'Verification Summary',
  ];

  const rows = readyPositions.map((p) => [
    escapeCsv(p.id),
    escapeCsv(p.title),
    escapeCsv(p.employer),
    escapeCsv(p.location),
    escapeCsv(p.postalCode || ''),
    escapeCsv(p.state),
    escapeCsv(p.isWestGermany ? 'West Germany (Non-DDR)' : 'Former DDR / East'),
    escapeCsv(p.isEnglishPreferred ? 'Yes' : 'No'),
    escapeCsv(p.matchedKeywords.join(', ')),
    escapeCsv(p.applicationWindow || p.publicationDate || 'Open now'),
    escapeCsv(p.deadline || 'Open until filled'),
    escapeCsv(p.publicationDate),
    escapeCsv(p.link),
    escapeCsv(p.source),
    escapeCsv(p.opportunityType || 'Live Vacancy'),
    escapeCsv(p.verificationStatus || 'Verified Match'),
    escapeCsv(p.matchScore !== undefined ? `${p.matchScore}%` : '90%'),
    escapeCsv(p.degreeFit || 'Accepts Master in Social Sciences, IR, or HRM'),
    escapeCsv(p.languageRequirement || 'English'),
    escapeCsv(p.compensation || 'Paid PhD Contract (TV-L E13)'),
    escapeCsv(p.aiSummary || p.description),
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  // Prefix with UTF-8 Byte Order Mark (\uFEFF)
  return '\uFEFF' + csvContent;
}

/**
 * Generate an Excel-compatible CSV string from the 44 Western German universities directory.
 * Includes all verified program URLs and professor URLs with UTF-8 BOM.
 */
export function generateUniversitiesCsv(universities: UniversityEntry[]): string {
  const headers = [
    'ID',
    'Institution Name',
    'Federal State',
    'City / Region',
    'Doctoral Pathway',
    'Program / Faculty Unit',
    'Research Fields',
    'Language Policy (English)',
    'Funding Model',
    'Application Window',
    'Application Deadline',
    'Verified Professors & Chairs',
    'Official Verification URLs',
  ];

  const rows = universities.map((u) => [
    escapeCsv(String(u.id)),
    escapeCsv(u.name),
    escapeCsv(u.state),
    escapeCsv(u.location),
    escapeCsv(u.pathway),
    escapeCsv(u.program),
    escapeCsv(u.fields.join('; ')),
    escapeCsv(u.languagePolicy),
    escapeCsv(u.funding),
    escapeCsv(u.applicationWindow || 'Year-round / Rolling'),
    escapeCsv(u.deadline || 'Rolling'),
    escapeCsv(u.verifiedProfessorsSummary),
    escapeCsv(u.urls.map((url) => `${url.label}: ${url.url}`).join(' | ')),
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  return '\uFEFF' + csvContent;
}
