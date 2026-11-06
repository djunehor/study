import { describe, it, expect } from 'vitest';
import { classifyCandidateState, resolveVerdictState } from '../src/evaluation-state-machine';
import { PhDPosition } from '../src/types';

describe('Evaluation State Machine', () => {
  const basePos: PhDPosition = {
    id: 'job-sm-1',
    title: 'Research Associate in Political Economy',
    employer: 'Uni Bonn',
    location: 'Bonn',
    state: 'North Rhine-Westphalia',
    isWestGermany: true,
    publicationDate: '2026-11-01',
    deadline: '2026-12-01',
    link: 'https://uni-bonn.de/job/1',
    matchedKeywords: ['political economy'],
    isEnglishPreferred: true,
    description: 'PhD position in political economy',
    source: 'test-source',
  };

  it('transitions to EXPIRED when detail page returned 404/410 Gone', () => {
    const res = classifyCandidateState({
      pos: basePos,
      detail: { markdown: '', isGone: true },
      cached: null,
      hasApiKey: true,
    });

    expect(res.state).toBe('EXPIRED');
    expect(res.finalPosition?.verificationStatus).toBe('Rejected');
    expect(res.finalPosition?.matchScore).toBe(0);
    expect(res.finalPosition?.degreeFit).toBe('Listing expired.');
  });

  it('transitions to CACHED when evaluation exists in cache', () => {
    const res = classifyCandidateState({
      pos: basePos,
      detail: { markdown: 'full text', isGone: false },
      cached: {
        verificationStatus: 'Verified Match',
        matchScore: 94,
        evaluatedBy: 'Gemini AI',
      },
      hasApiKey: true,
    });

    expect(res.state).toBe('CACHED');
    expect(res.finalPosition?.verificationStatus).toBe('Verified Match');
    expect(res.finalPosition?.matchScore).toBe(94);
  });

  it('transitions to GEO_EXCLUDED when outside Western Germany', () => {
    const eastPos: PhDPosition = {
      ...basePos,
      state: 'Saxony',
      isWestGermany: false,
    };

    const res = classifyCandidateState({
      pos: eastPos,
      detail: { markdown: 'full text', isGone: false },
      cached: null,
      hasApiKey: true,
    });

    expect(res.state).toBe('GEO_EXCLUDED');
    expect(res.finalPosition?.verificationStatus).toBe('Rejected');
    expect(res.finalPosition?.matchScore).toBe(0);
  });

  it('transitions to NO_API_KEY when candidate is in West Germany but API key is absent', () => {
    const res = classifyCandidateState({
      pos: basePos,
      detail: { markdown: 'full text', isGone: false },
      cached: null,
      hasApiKey: false,
    });

    expect(res.state).toBe('NO_API_KEY');
    expect(res.finalPosition?.verificationStatus).toBe('Unverified');
    expect(res.finalPosition?.languageRequirement).toBe('Requires Manual Review');
  });

  it('transitions to QUEUED_FOR_EVALUATION when valid for Gemini AI evaluation', () => {
    const res = classifyCandidateState({
      pos: basePos,
      detail: { markdown: 'full text', isGone: false },
      cached: null,
      hasApiKey: true,
    });

    expect(res.state).toBe('QUEUED_FOR_EVALUATION');
    expect(res.candidateToEvaluate).toBeDefined();
    expect(res.candidateToEvaluate?.pos.id).toBe('job-sm-1');
  });

  it('resolves verdict state accurately for verified matches', () => {
    const resolved = resolveVerdictState(basePos, {
      id: 'job-sm-1',
      englishTitle: 'PhD in Comparative Industrial Relations',
      englishEmployer: 'University of Bonn',
      englishLocation: 'Bonn',
      applicationWindow: 'Open now',
      englishDeadline: '15 December 2026',
      state: 'North Rhine-Westphalia',
      isWestGermany: true,
      isEnglishPreferred: true,
      matchedKeywords: ['industrial relations'],
      verificationStatus: 'Verified Match',
      matchScore: 98,
      degreeFit: 'Fits MSc Industrial Relations and HRM',
      languageRequirement: '100% English working group',
      compensation: 'TV-L E13 75%',
      aiSummary: 'Verified match for profile.',
    });

    expect(resolved.verificationStatus).toBe('Verified Match');
    expect(resolved.matchScore).toBe(98);
    expect(resolved.evaluatedBy).toBe('Gemini AI');
    expect(resolved.title).toBe('PhD in Comparative Industrial Relations');
  });

  it('resolves verdict state to Unverified when verdict is missing/failed', () => {
    const resolved = resolveVerdictState(basePos, undefined);

    expect(resolved.verificationStatus).toBe('Unverified');
    expect(resolved.matchScore).toBe(0);
    expect(resolved.evaluatedBy).toBe('Rule Engine');
  });
});

