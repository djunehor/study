import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { PhDPosition } from './types';

export interface StorageOptions {
  dbPath?: string;
}

let dbInstance: DatabaseSync | null = null;

export function getDatabase(dbPath?: string): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }
  const resolvedPath = dbPath || process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'phd_storage.db');
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(resolvedPath);
  initDatabase(db);
  dbInstance = db;
  return db;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function initDatabase(db: DatabaseSync): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      employer TEXT,
      location TEXT,
      postal_code TEXT,
      state TEXT,
      is_west_germany INTEGER,
      publication_date TEXT,
      application_window TEXT,
      deadline TEXT,
      link TEXT NOT NULL,
      matched_keywords TEXT,
      is_english_preferred INTEGER,
      description TEXT,
      source TEXT,
      opportunity_type TEXT,
      verification_status TEXT,
      match_score INTEGER,
      degree_fit TEXT,
      language_requirement TEXT,
      compensation TEXT,
      ai_summary TEXT,
      evaluated_by TEXT,
      first_seen_at TEXT NOT NULL,
      last_updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      opportunity_type TEXT,
      verification_status TEXT,
      match_score INTEGER,
      degree_fit TEXT,
      language_requirement TEXT,
      compensation TEXT,
      ai_summary TEXT,
      evaluated_by TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

export function savePositions(positions: PhDPosition[], db?: DatabaseSync): void {
  const targetDb = db || getDatabase();
  const now = new Date().toISOString();

  const insertStmt = targetDb.prepare(`
    INSERT INTO positions (
      id, title, employer, location, postal_code, state,
      is_west_germany, publication_date, application_window, deadline,
      link, matched_keywords, is_english_preferred, description,
      source, opportunity_type, verification_status, match_score,
      degree_fit, language_requirement, compensation, ai_summary,
      evaluated_by, first_seen_at, last_updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      employer = excluded.employer,
      location = excluded.location,
      postal_code = excluded.postal_code,
      state = excluded.state,
      is_west_germany = excluded.is_west_germany,
      publication_date = excluded.publication_date,
      application_window = excluded.application_window,
      deadline = excluded.deadline,
      link = excluded.link,
      matched_keywords = excluded.matched_keywords,
      is_english_preferred = excluded.is_english_preferred,
      description = excluded.description,
      source = excluded.source,
      opportunity_type = excluded.opportunity_type,
      verification_status = excluded.verification_status,
      match_score = excluded.match_score,
      degree_fit = excluded.degree_fit,
      language_requirement = excluded.language_requirement,
      compensation = excluded.compensation,
      ai_summary = excluded.ai_summary,
      evaluated_by = excluded.evaluated_by,
      last_updated_at = excluded.last_updated_at
  `);

  for (const pos of positions) {
    insertStmt.run(
      pos.id,
      pos.title || '',
      pos.employer || '',
      pos.location || '',
      pos.postalCode || '',
      pos.state || '',
      pos.isWestGermany ? 1 : 0,
      pos.publicationDate || '',
      pos.applicationWindow || '',
      pos.deadline || '',
      pos.link || '',
      JSON.stringify(pos.matchedKeywords || []),
      pos.isEnglishPreferred ? 1 : 0,
      pos.description || '',
      pos.source || '',
      pos.opportunityType || '',
      pos.verificationStatus || '',
      pos.matchScore ?? null,
      pos.degreeFit || '',
      pos.languageRequirement || '',
      pos.compensation || '',
      pos.aiSummary || '',
      pos.evaluatedBy || '',
      now,
      now
    );
  }
}

export function saveEvaluation(id: string, evaluation: Partial<PhDPosition>, db?: DatabaseSync): void {
  const targetDb = db || getDatabase();
  const now = new Date().toISOString();

  const insertStmt = targetDb.prepare(`
    INSERT INTO evaluations (
      id, opportunity_type, verification_status, match_score,
      degree_fit, language_requirement, compensation, ai_summary,
      evaluated_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      opportunity_type = excluded.opportunity_type,
      verification_status = excluded.verification_status,
      match_score = excluded.match_score,
      degree_fit = excluded.degree_fit,
      language_requirement = excluded.language_requirement,
      compensation = excluded.compensation,
      ai_summary = excluded.ai_summary,
      evaluated_by = excluded.evaluated_by,
      created_at = excluded.created_at
  `);

  insertStmt.run(
    id,
    evaluation.opportunityType || '',
    evaluation.verificationStatus || '',
    evaluation.matchScore ?? null,
    evaluation.degreeFit || '',
    evaluation.languageRequirement || '',
    evaluation.compensation || '',
    evaluation.aiSummary || '',
    evaluation.evaluatedBy || '',
    now
  );
}

export function getEvaluationFromDb(id: string, db?: DatabaseSync): Partial<PhDPosition> | null {
  const targetDb = db || getDatabase();
  const selectStmt = targetDb.prepare('SELECT * FROM evaluations WHERE id = ?');
  const row = selectStmt.get(id) as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }
  return {
    opportunityType: (row.opportunity_type as 'Live Vacancy' | 'Structured PhD Program') || undefined,
    verificationStatus: (row.verification_status as 'Verified Match' | 'Conditional Match' | 'Rejected' | 'Unverified') || undefined,
    matchScore: typeof row.match_score === 'number' ? row.match_score : undefined,
    degreeFit: (row.degree_fit as string) || undefined,
    languageRequirement: (row.language_requirement as string) || undefined,
    compensation: (row.compensation as string) || undefined,
    aiSummary: (row.ai_summary as string) || undefined,
    evaluatedBy: (row.evaluated_by as 'Gemini AI' | 'Rule Engine') || undefined,
  };
}

export function getAllStoredPositions(db?: DatabaseSync): PhDPosition[] {
  const targetDb = db || getDatabase();
  const rows = targetDb.prepare('SELECT * FROM positions ORDER BY match_score DESC').all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    employer: String(row.employer || ''),
    location: String(row.location || ''),
    postalCode: String(row.postal_code || ''),
    state: String(row.state || ''),
    isWestGermany: Boolean(row.is_west_germany),
    publicationDate: String(row.publication_date || ''),
    applicationWindow: String(row.application_window || ''),
    deadline: String(row.deadline || ''),
    link: String(row.link || ''),
    matchedKeywords: row.matched_keywords ? JSON.parse(String(row.matched_keywords)) : [],
    isEnglishPreferred: Boolean(row.is_english_preferred),
    description: String(row.description || ''),
    source: String(row.source || ''),
    opportunityType: (row.opportunity_type as 'Live Vacancy' | 'Structured PhD Program') || undefined,
    verificationStatus: (row.verification_status as 'Verified Match' | 'Conditional Match' | 'Rejected' | 'Unverified') || undefined,
    matchScore: typeof row.match_score === 'number' ? row.match_score : undefined,
    degreeFit: String(row.degree_fit || ''),
    languageRequirement: String(row.language_requirement || ''),
    compensation: String(row.compensation || ''),
    aiSummary: String(row.ai_summary || ''),
    evaluatedBy: (row.evaluated_by as 'Gemini AI' | 'Rule Engine') || undefined,
  }));
}
