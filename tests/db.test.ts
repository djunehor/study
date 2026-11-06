import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { initDatabase, savePositions, getAllStoredPositions, saveEvaluation, getEvaluationFromDb } from '../src/db';
import { PhDPosition } from '../src/types';

describe('SQLite persistent storage', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    initDatabase(db);
  });

  it('initializes tables properly', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain('positions');
    expect(names).toContain('evaluations');
  });

  it('saves and retrieves positions correctly', () => {
    const sample: PhDPosition = {
      id: 'test-pos-1',
      title: 'PhD Candidate in Global Governance',
      employer: 'University of Göttingen',
      location: 'Göttingen',
      state: 'Lower Saxony',
      isWestGermany: true,
      publicationDate: '2026-11-01',
      deadline: '2026-12-15',
      link: 'https://uni-goettingen.de/job1',
      matchedKeywords: ['Global Governance', 'International Relations'],
      isEnglishPreferred: true,
      description: 'PhD position funded by DFG',
      source: 'Direct University Feeds',
      opportunityType: 'Live Vacancy',
      verificationStatus: 'Verified Match',
      matchScore: 95,
      degreeFit: 'Perfect fit for International Relations',
      languageRequirement: '100% English',
      compensation: 'TV-L E13 65%',
      aiSummary: 'Verified matching position.',
      evaluatedBy: 'Gemini AI',
    };

    savePositions([sample], db);
    const retrieved = getAllStoredPositions(db);
    expect(retrieved.length).toBe(1);
    expect(retrieved[0].id).toBe('test-pos-1');
    expect(retrieved[0].employer).toBe('University of Göttingen');
    expect(retrieved[0].matchScore).toBe(95);
    expect(retrieved[0].isWestGermany).toBe(true);
  });

  it('stores and retrieves individual evaluation data', () => {
    saveEvaluation('eval-1', {
      opportunityType: 'Live Vacancy',
      verificationStatus: 'Verified Match',
      matchScore: 92,
      evaluatedBy: 'Gemini AI',
      languageRequirement: '100% English',
    }, db);

    const retrieved = getEvaluationFromDb('eval-1', db);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.verificationStatus).toBe('Verified Match');
    expect(retrieved?.matchScore).toBe(92);
    expect(retrieved?.evaluatedBy).toBe('Gemini AI');
  });
});

