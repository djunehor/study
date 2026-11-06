export interface KeywordMatch {
  isMatch: boolean;
  matchedKeywords: string[];
  isAcademicOrPaid: boolean;
  isEnglishPreferred: boolean;
}

// Indicator keywords for PhD and paid academic research positions in Germany
const ACADEMIC_KEYWORDS = [
  'wissenschaftliche',
  'wissenschaftlicher',
  'wissenschaftlichen',
  'wiss. mitarbeiter',
  'wiss. beschäftigte',
  'akademische',
  'akademischer',
  'doktorand',
  'doktorandin',
  'prä-doc',
  'prae-doc',
  'pre-doc',
  'phd',
  'ph.d',
  'promotion',
  'promotionsstelle',
  'promotionsmöglichkeit',
  'research associate',
  'research assistant',
  'doctoral researcher',
  'doctoral candidate',
  'doctoral position',
  'fellowship',
  'tv-l',
  'tvl-13',
  'tv-l e13',
  'tv-l 13',
  'e 13',
  'e13',
  'tvöd',
  'tvöd 13',
];

// Exclude non-doctoral roles (Professorships, Postdoc-only roles, Student/Clerical jobs)
const EXCLUDED_ROLE_KEYWORDS = [
  'professur',
  'universitätsprofessur',
  'juniorprofessur',
  'open-rank professorship',
  'w1',
  'w2',
  'w3',
  'postdoc',
  'post-doc',
  'postdoctoral',
  'akademischer rat',
  'akademische rätin',
  'studentische hilfskraft',
  'studentische oder wissenschaftliche hilfskräfte',
  'student assistant',
  'studierende',
  'hilfsassistenz',
  'praktikum',
  'intern ',
  'sekretär',
  'fremdsprachensekretär',
  'fremdsprachensektretär',
  'reinigungskraft',
  'sachbearbeiter',
  'sachbearbeitung',
  'geschäftsführer',
  'verwaltungsmitarbeiter',
  'präsident',
  'mechatroniker',
  'it-administrator',
  'it-anwendungsmanager',
  'medientechnik',
  'reviergärtner',
  'tierpfleger',
  'chemisch-technische',
];

// Exclude unrelated STEM / engineering / medical fields
const EXCLUDED_STEM_KEYWORDS = [
  'künstliche intelligenz',
  'artificial intelligence',
  'omero',
  'physik',
  'physics',
  'chemie',
  'chemistry',
  'bioorganisch',
  'maschinenbau',
  'mechanical engineering',
  'elektrotechnik',
  'mechatronik',
  'fügetechnik',
  'fabrikplanung',
  'bauplanung',
  'civil engineering',
  'architecture',
  'arithmetischer geometrie',
  'hybrid powertrains',
  'asphalt',
  'neutron',
  'photon',
  'x-ray',
  'laser',
  'metabolomics',
  'klinische psychologie',
  'computational intelligence',
  'pflanzenbau',
  'altertumswissenschaft',
  'ancient civilizations',
];

// Target focus areas for Industrial Relations, Human Resource Management, International Relations & Social Sciences
const SUBJECT_KEYWORDS: { pattern: string; label: string }[] = [
  // Human Resource Management & Organization
  { pattern: 'human resource', label: 'human resource' },
  { pattern: 'human resources', label: 'human resources' },
  { pattern: 'personalwesen', label: 'personalwesen' },
  { pattern: 'personalmanagement', label: 'personalmanagement' },
  { pattern: 'personalwirtschaft', label: 'personalwirtschaft' },
  { pattern: 'personalökonomik', label: 'personalökonomik' },
  { pattern: 'personalführung', label: 'personalführung' },
  { pattern: 'work and organization', label: 'work and organization' },
  { pattern: 'organizational behavior', label: 'organizational behavior' },
  { pattern: 'organisationssoziologie', label: 'organisationssoziologie' },
  { pattern: 'corporate governance', label: 'corporate governance' },
  { pattern: 'betriebswirtschaft', label: 'management / business' },
  { pattern: 'wirtschaftswissenschaft', label: 'economics & management' },

  // Industrial Relations & Labor Studies
  { pattern: 'industrial relations', label: 'industrial relations' },
  { pattern: 'arbeitsbeziehungen', label: 'arbeitsbeziehungen' },
  { pattern: 'employment relations', label: 'employment relations' },
  { pattern: 'employment systems', label: 'employment relations' },
  { pattern: 'labor relations', label: 'labor relations' },
  { pattern: 'labour relations', label: 'labour relations' },
  { pattern: 'labor market', label: 'labor market' },
  { pattern: 'labour market', label: 'labour market' },
  { pattern: 'arbeitsmarkt', label: 'arbeitsmarkt' },
  { pattern: 'zukunft der arbeit', label: 'future of work' },
  { pattern: 'sociology of work', label: 'sociology of work' },
  { pattern: 'arbeitssoziologie', label: 'arbeitssoziologie' },
  { pattern: 'arbeitsforschung', label: 'arbeitsforschung' },
  { pattern: 'arbeitsrecht', label: 'arbeitsrecht' },
  { pattern: 'trade union', label: 'trade union' },
  { pattern: 'gewerkschaft', label: 'gewerkschaft' },
  { pattern: 'mitbestimmung', label: 'mitbestimmung' },
  { pattern: 'codetermination', label: 'codetermination' },

  // International Relations, Political Science & Social Sciences
  { pattern: 'international relations', label: 'international relations' },
  { pattern: 'internationale beziehungen', label: 'internationale beziehungen' },
  { pattern: 'internationale politik', label: 'international politics' },
  { pattern: 'international politics', label: 'international politics' },
  { pattern: 'political science', label: 'political science' },
  { pattern: 'politikwissenschaft', label: 'political science' },
  { pattern: 'politics', label: 'politics' },
  { pattern: 'global governance', label: 'global governance' },
  { pattern: 'public policy', label: 'public policy' },
  { pattern: 'verwaltungswissenschaft', label: 'public administration' },
  { pattern: 'social sciences', label: 'social sciences' },
  { pattern: 'sozialwissenschaft', label: 'social sciences' },
  { pattern: 'sociology', label: 'sociology' },
  { pattern: 'soziologie', label: 'sociology' },
  { pattern: 'bevölkerungsforschung', label: 'demography & social research' },
  { pattern: 'economics', label: 'economics' },
  { pattern: 'ökonometrie', label: 'econometrics & quantitative methods' },
  { pattern: 'volkswirtschaft', label: 'economics' },
];

// English indicators in posting title or description
const ENGLISH_INDICATORS = [
  'phd',
  'research associate',
  'research assistant',
  'doctoral researcher',
  'doctoral position',
  'doctoral candidate',
  'human resources',
  'industrial relations',
  'international relations',
  'international',
  'english',
  'qualification',
  'faculty',
  'department',
  'fellowship',
  'management',
  'global',
  'competition',
  'governance',
  'working language is english',
];

/**
 * Checks if a job title and description match the target PhD and subject requirements.
 */
export function matchJobKeywords(title: string, description: string): KeywordMatch {
  const cleanTitle = title.replaceAll('\u00AD', '').replaceAll('&shy;', '').replaceAll('&SHY;', '');
  const cleanDesc = description.replaceAll('\u00AD', '').replaceAll('&shy;', '').replaceAll('&SHY;', '');
  const combined = `${cleanTitle} ${cleanDesc}`.toLowerCase();
  const lowerTitle = cleanTitle.toLowerCase();

  // Check if role is explicitly excluded (Professorship, Postdoc, Student Assistant, Clerical)
  const isExcludedRole = EXCLUDED_ROLE_KEYWORDS.some((kw) => combined.includes(kw));
  const isExcludedStem = EXCLUDED_STEM_KEYWORDS.some((kw) => combined.includes(kw));

  const isAcademicOrPaid =
    !isExcludedRole && !isExcludedStem && ACADEMIC_KEYWORDS.some((kw) => combined.includes(kw));

  const matchedSet = new Set<string>();
  for (const item of SUBJECT_KEYWORDS) {
    if (combined.includes(item.pattern)) {
      matchedSet.add(item.label);
    }
  }
  const matchedKeywords = Array.from(matchedSet);

  // English preference check
  let englishScore = 0;
  for (const kw of ENGLISH_INDICATORS) {
    if (combined.includes(kw)) {
      englishScore++;
    }
  }

  const titleEnglishTerms = [
    'phd',
    'doctoral',
    'research associate',
    'research assistant',
    'competition',
    'governance',
  ];
  const isEnglishPreferred =
    englishScore >= 2 ||
    combined.includes('english') ||
    titleEnglishTerms.some((term) => lowerTitle.includes(term));

  // Must be both an eligible doctoral/academic position AND match at least one target subject keyword
  const isMatch = isAcademicOrPaid && matchedKeywords.length > 0;

  return {
    isMatch,
    matchedKeywords,
    isAcademicOrPaid,
    isEnglishPreferred,
  };
}
