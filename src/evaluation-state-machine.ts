import { PhDPosition } from './types';
import { DetailPageData, GeminiVerdict } from './evaluator';

export type EvaluationState =
  | 'EXPIRED'
  | 'CACHED'
  | 'GEO_EXCLUDED'
  | 'NO_API_KEY'
  | 'QUEUED_FOR_EVALUATION';

export interface EvaluationInput {
  pos: PhDPosition;
  detail?: DetailPageData;
  cached?: Partial<PhDPosition> | null;
  hasApiKey: boolean;
}

export interface StateResolution {
  state: EvaluationState;
  finalPosition?: PhDPosition;
  candidateToEvaluate?: { pos: PhDPosition; markdown: string };
}

/**
 * Pure state machine transition function for initial position classification.
 */
export function classifyCandidateState(input: EvaluationInput): StateResolution {
  const { pos, detail, cached, hasApiKey } = input;

  // 1. Terminal State: Expired (HTTP 404/410)
  if (detail?.isGone) {
    return {
      state: 'EXPIRED',
      finalPosition: {
        ...pos,
        opportunityType: 'Live Vacancy',
        verificationStatus: 'Rejected',
        matchScore: 0,
        degreeFit: 'Listing expired.',
        languageRequirement: 'N/A',
        compensation: 'N/A',
        aiSummary: 'Rejected: The job listing page returned HTTP 404/410 (expired).',
        evaluatedBy: 'Rule Engine',
      },
    };
  }

  // 2. Terminal State: Cached evaluation available
  if (cached && (!hasApiKey || cached.evaluatedBy === 'Gemini AI')) {
    return {
      state: 'CACHED',
      finalPosition: {
        ...pos,
        ...cached,
      },
    };
  }

  // 3. Terminal State: Non-Western Germany exclusion
  if (!pos.isWestGermany) {
    return {
      state: 'GEO_EXCLUDED',
      finalPosition: {
        ...pos,
        opportunityType: 'Live Vacancy',
        verificationStatus: 'Rejected',
        matchScore: 0,
        degreeFit: 'Excluded: Located outside Western Germany.',
        languageRequirement: 'N/A',
        compensation: 'N/A',
        aiSummary: `Rejected: Located in ${pos.state} (outside Western Germany specification).`,
        evaluatedBy: 'Rule Engine',
      },
    };
  }

  // 4. Terminal State: Unverified when no API key exists
  if (!hasApiKey) {
    return {
      state: 'NO_API_KEY',
      finalPosition: {
        ...pos,
        opportunityType: 'Live Vacancy',
        verificationStatus: 'Unverified',
        matchScore: 0,
        degreeFit: 'Unverified: Gemini API key not provided.',
        languageRequirement: 'Requires Manual Review',
        compensation: 'Requires Manual Review',
        aiSummary: 'Unverified: Could not evaluate requirements because GEMINI_API_KEY is not configured.',
        evaluatedBy: 'Rule Engine',
      },
    };
  }

  // 5. Active State: Ready for Gemini API Evaluation
  return {
    state: 'QUEUED_FOR_EVALUATION',
    candidateToEvaluate: {
      pos,
      markdown: detail?.markdown || pos.description,
    },
  };
}

/**
 * Pure state machine transition function for Gemini AI evaluation verdict.
 */
export function resolveVerdictState(pos: PhDPosition, verdict?: GeminiVerdict): PhDPosition {
  if (verdict) {
    return {
      ...pos,
      title: verdict.englishTitle || pos.title,
      employer: verdict.englishEmployer || pos.employer,
      location: verdict.englishLocation || pos.location,
      applicationWindow: verdict.applicationWindow || pos.applicationWindow,
      deadline: verdict.englishDeadline || pos.deadline,
      state: verdict.state || pos.state,
      isWestGermany: typeof verdict.isWestGermany === 'boolean' ? verdict.isWestGermany : pos.isWestGermany,
      isEnglishPreferred: typeof verdict.isEnglishPreferred === 'boolean' ? verdict.isEnglishPreferred : pos.isEnglishPreferred,
      matchedKeywords: Array.isArray(verdict.matchedKeywords) && verdict.matchedKeywords.length > 0 ? verdict.matchedKeywords : pos.matchedKeywords,
      opportunityType: pos.opportunityType || 'Live Vacancy',
      verificationStatus: verdict.verificationStatus,
      matchScore: verdict.matchScore,
      degreeFit: verdict.degreeFit,
      languageRequirement: verdict.languageRequirement,
      compensation: verdict.compensation,
      aiSummary: verdict.aiSummary,
      evaluatedBy: 'Gemini AI',
    };
  }

  // Evaluation failed or not received for this candidate
  return {
    ...pos,
    opportunityType: pos.opportunityType || 'Live Vacancy',
    verificationStatus: 'Unverified',
    matchScore: 0,
    degreeFit: 'Unverified: Gemini evaluation failed or timed out.',
    languageRequirement: 'Requires Manual Review',
    compensation: 'Requires Manual Review',
    aiSummary: 'Unverified: Automated Gemini AI evaluation was unsuccessful. Manual inspection required.',
    evaluatedBy: 'Rule Engine',
  };
}

