import { PhDPosition, UniversityEntry, EnglishJobEntry } from './types';
import { JOBS_GOTTINGEN_DATA } from './jobs-gottingen-data';

/**
 * Render the mobile-responsive dashboard HTML using ASD-STE100 Simplified Technical English.
 */
export function renderDashboardHtml(
  positions: PhDPosition[],
  universities: UniversityEntry[],
  englishJobs: EnglishJobEntry[] = JOBS_GOTTINGEN_DATA
): string {
  const jsonPositions = JSON.stringify(positions);
  const jsonUniversities = JSON.stringify(universities);
  const jsonEnglishJobs = JSON.stringify(englishJobs);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>German PhD Position Scanner & University Directory</title>
  <style>
    :root {
      --primary: #1e3a8a;
      --primary-light: #2563eb;
      --primary-hover: #172554;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #0f172a;
      --text-muted: #475569;
      --border: #e2e8f0;
      --success: #166534;
      --success-bg: #dcfce7;
      --danger: #991b1b;
      --danger-bg: #fee2e2;
      --tag-bg: #ede9fe;
      --tag-text: #5b21b6;
      --accent-bg: #e0f2fe;
      --accent-text: #0369a1;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 16px;
    }

    .container {
      max-width: 1240px;
      width: 100%;
      margin: 0 auto;
      overflow-wrap: anywhere;
    }

    header {
      background: var(--card-bg);
      padding: 24px;
      border-radius: 12px;
      border: 1px solid var(--border);
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    h1 {
      font-size: 1.5rem;
      color: var(--primary);
      margin-bottom: 8px;
    }

    p.lead {
      color: var(--text-muted);
      font-size: 0.95rem;
      margin-bottom: 16px;
    }

    .profile-banner {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 0.86rem;
      color: #1e3a8a;
      margin-bottom: 16px;
    }

    .summary-kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }

    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px 16px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }

    .kpi-value {
      font-size: 1.45rem;
      font-weight: 700;
      color: var(--primary);
    }

    .kpi-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .tabs {
      display: flex;
      gap: 8px;
      border-bottom: 2px solid var(--border);
      margin-bottom: 20px;
      overflow-x: auto;
    }

    .tab-btn {
      padding: 10px 18px;
      background: none;
      border: none;
      border-bottom: 3px solid transparent;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }

    .tab-btn:hover {
      color: var(--primary);
    }

    .tab-btn.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    .actions-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .actions-left, .actions-right {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 18px;
      font-size: 0.92rem;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      text-decoration: none;
      transition: background-color 0.2s;
      border: none;
      min-height: 42px;
    }

    .btn-primary {
      background-color: var(--primary);
      color: #ffffff;
    }

    .btn-primary:hover {
      background-color: var(--primary-hover);
    }

    .btn-secondary {
      background-color: #f1f5f9;
      color: var(--text);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      background-color: #e2e8f0;
    }

    .filters-card {
      background: var(--card-bg);
      padding: 20px;
      border-radius: 12px;
      border: 1px solid var(--border);
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .filters-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 16px;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-muted);
    }

    input[type="text"], input[type="password"], select {
      padding: 10px 12px;
      font-size: 0.92rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #ffffff;
      color: var(--text);
      min-height: 42px;
    }

    .checkbox-row {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid var(--border);
    }

    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }

    .checkbox-group input {
      width: 18px;
      height: 18px;
    }

    .stats {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 14px;
    }

    .badge {
      display: inline-block;
      padding: 3px 8px;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: 4px;
    }

    .badge-west {
      background-color: var(--success-bg);
      color: var(--success);
    }

    .badge-ddr {
      background-color: var(--danger-bg);
      color: var(--danger);
    }

    .badge-tag {
      background-color: var(--tag-bg);
      color: var(--tag-text);
      margin-right: 4px;
      margin-bottom: 4px;
    }

    .badge-pathway {
      background-color: var(--accent-bg);
      color: var(--accent-text);
    }

    .ai-box {
      background: #f8fafc;
      border-left: 3px solid var(--primary-light);
      padding: 8px 10px;
      border-radius: 4px;
      font-size: 0.82rem;
      color: var(--text);
      margin-top: 6px;
    }

    .ai-box.rejected {
      border-left-color: var(--danger);
      background: #fef2f2;
    }

    .ai-detail-line {
      font-size: 0.78rem;
      color: var(--text-muted);
      margin-top: 3px;
    }

    .jobs-table-wrapper {
      background: var(--card-bg);
      border-radius: 12px;
      border: 1px solid var(--border);
      overflow-x: auto;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      margin-bottom: 24px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.9rem;
    }

    th {
      background-color: #f1f5f9;
      padding: 12px 16px;
      font-weight: 600;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
    }

    td {
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }

    tr:hover td {
      background-color: #f8fafc;
    }

    .job-title {
      font-weight: 600;
      color: var(--primary);
      text-decoration: none;
      display: block;
      margin-bottom: 4px;
    }

    .job-title:hover {
      text-decoration: underline;
    }

    .job-meta {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .uni-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .uni-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 10px;
    }

    .uni-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--primary);
    }

    .uni-meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 12px;
    }

    .uni-section-title {
      font-size: 0.82rem;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-top: 10px;
      margin-bottom: 4px;
    }

    .uni-text {
      font-size: 0.9rem;
      color: var(--text);
      margin-bottom: 8px;
    }

    .links-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }

    .url-pill {
      display: inline-flex;
      align-items: center;
      padding: 6px 12px;
      font-size: 0.82rem;
      font-weight: 600;
      background: #eff6ff;
      color: var(--primary-light);
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      text-decoration: none;
      transition: all 0.2s;
    }

    .url-pill:hover {
      background: var(--primary-light);
      color: #ffffff;
      border-color: var(--primary-light);
    }

    .portal-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .portal-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .portal-card h3 {
      font-size: 1.1rem;
      color: var(--primary);
      margin-bottom: 8px;
    }

    .portal-card p {
      font-size: 0.88rem;
      color: var(--text-muted);
      margin-bottom: 16px;
    }

    @media (max-width: 768px) {
      .jobs-table-wrapper {
        background: transparent;
        border: none;
        box-shadow: none;
      }

      table, thead, tbody, th, td, tr {
        display: block;
        width: 100%;
        max-width: 100%;
      }

      thead {
        display: none;
      }

      tr {
        background: var(--card-bg);
        border: 1px solid var(--border);
        border-radius: 12px;
        margin-bottom: 16px;
        padding: 16px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      }

      td {
        border-bottom: none;
        padding: 6px 0;
        overflow-wrap: anywhere;
      }

      td::before {
        content: attr(data-label) ": ";
        font-weight: 600;
        color: var(--text-muted);
        display: block;
        margin-bottom: 2px;
      }

      td[data-label="Title"]::before {
        display: none;
      }

      .uni-header {
        flex-direction: column;
      }

      .actions-bar, .actions-left, .actions-right {
        flex-direction: column;
        align-items: stretch;
        width: 100%;
      }

      #geminiKeyInput {
        width: 100% !important;
        min-width: 0 !important;
      }

      .btn {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>German PhD Position Scanner & University Directory</h1>
      <p class="lead">
        This automated system crawls full job detail pages and verifies paid English PhD positions and structured doctoral courses in western German states.
      </p>
      <div class="profile-banner">
        <strong>Active Verification Specification:</strong> BSc in International Relations + Master in Industrial Relations and Human Resource Management (HRM) | <strong>Language:</strong> English Only (Rejects C1/C2 German requirements) | <strong>Region:</strong> Western Germany Only (Excludes Former DDR & Berlin) | <strong>Funding:</strong> Paid PhD Contracts (TV-L E13 / MSCA / Fellowships)
      </div>
      
      <div class="tabs">
        <button class="tab-btn active" data-tab="gottingenTab" onclick="switchTab('gottingenTab')">Göttingen & Remote English Jobs (${englishJobs.length})</button>
        <button class="tab-btn" data-tab="jobsTab" onclick="switchTab('jobsTab')">Verified Ready-to-Apply PhD List</button>
        <button class="tab-btn" data-tab="unisTab" onclick="switchTab('unisTab')">44 Western Universities & Professors</button>
        <button class="tab-btn" data-tab="portalsTab" onclick="switchTab('portalsTab')">Manual Search & Portals</button>
      </div>
    </header>

    <!-- TAB: GÖTTINGEN & REMOTE ENGLISH JOBS (${englishJobs.length}) -->
    <div id="gottingenTab" class="tab-content active">
      <div class="summary-kpi-grid">
        <div class="kpi-card">
          <div class="kpi-value" id="kpiGottingenTotal">0</div>
          <div class="kpi-label">Verified English Jobs</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value" id="kpiGottingenLocal" style="color: #166534;">0</div>
          <div class="kpi-label">Göttingen Onsite / Hybrid</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value" id="kpiGottingenRemote" style="color: #2563eb;">0</div>
          <div class="kpi-label">100% Remote (Germany)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value" id="kpiGottingenEnglish">100%</div>
          <div class="kpi-label">Zero German Required</div>
        </div>
      </div>

      <div class="actions-bar">
        <div class="actions-left">
          <a href="/api/export-gottingen-jobs" class="btn btn-primary" id="exportGottingenBtn" download="gottingen_remote_english_jobs.csv">
            Download English Jobs (CSV)
          </a>
        </div>
        <div class="actions-right">
          <span style="font-size: 0.85rem; color: var(--text-muted);">Verified Candidate Profile: BSc International Relations, MSc Industrial Relations & HRM, Customer Care</span>
        </div>
      </div>

      <div class="filters-card">
        <div class="filters-grid">
          <div class="filter-group">
            <label for="gottingenSearchInput">Search Job Title, Employer, or Keyword</label>
            <input type="text" id="gottingenSearchInput" placeholder="e.g. Customer, Excelitas, Sartorius, Human Resources" oninput="applyGottingenFilters()">
          </div>
          <div class="filter-group">
            <label for="gottingenLocationSelect">Workplace Location</label>
            <select id="gottingenLocationSelect" onchange="applyGottingenFilters()">
              <option value="ALL">All Workplaces (Göttingen + 100% Remote)</option>
              <option value="GÖTTINGEN">Göttingen Onsite / Hybrid Only</option>
              <option value="REMOTE">100% Remote Germany Only</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="gottingenCategorySelect">Job Category</label>
            <select id="gottingenCategorySelect" onchange="applyGottingenFilters()">
              <option value="ALL">All Categories</option>
              <option value="Customer Care">Customer Care / Support</option>
              <option value="Human Resources">Human Resources & Recruiting</option>
              <option value="Operations">Operations & Coordination</option>
              <option value="Administration">Administration & Clerk</option>
              <option value="Client Relations">Client Relations & Account Management</option>
              <option value="Support & Training">Support & Training</option>
              <option value="Communications">Communications & Social Media</option>
              <option value="Academic / Research">Academic / Research</option>
            </select>
          </div>
        </div>
      </div>

      <div class="stats" id="gottingenStatsBar">Showing 0 positions</div>

      <div class="jobs-table-wrapper">
        <table>
          <thead>
            <tr>
              <th style="width: 5%;">#</th>
              <th style="width: 27%;">Job Title & Employer</th>
              <th style="width: 17%;">Workplace Location</th>
              <th style="width: 14%;">Category</th>
              <th style="width: 25%;">Gemini Fit Assessment</th>
              <th style="width: 12%;">Action</th>
            </tr>
          </thead>
          <tbody id="gottingenTableBody">
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 1: VERIFIED READY-TO-APPLY PHD LIST -->
    <div id="jobsTab" class="tab-content">
      <div class="summary-kpi-grid">
        <div class="kpi-card">
          <div class="kpi-value" id="kpiReadyCount">0</div>
          <div class="kpi-label">Ready-to-Apply PhD Opportunities</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value" id="kpiLiveCount">0</div>
          <div class="kpi-label">Verified Live Job Vacancies</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value" id="kpiProgramCount">0</div>
          <div class="kpi-label">Verified University PhD Programs</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value" id="kpiRejectedCount" style="color: #991b1b;">0</div>
          <div class="kpi-label">Auto-Rejected After Full-Page Check</div>
        </div>
      </div>

      <div class="actions-bar">
        <div class="actions-left">
          <a href="/api/export" class="btn btn-primary" id="exportBtn" download="german_phd_positions.csv">
            Download Vacancies (CSV)
          </a>
          <button class="btn btn-secondary" id="refreshBtn" onclick="runScan()">
            Scan Feed Websites Now
          </button>
        </div>
        <div class="actions-right">
          <input type="password" id="geminiKeyInput" placeholder="Optional: Gemini API Key for AI re-scoring" style="min-width: 270px;" onchange="saveGeminiKey()">
        </div>
      </div>

      <div class="filters-card">
        <div class="filters-grid">
          <div class="filter-group">
            <label for="searchInput">Search Title, Topic, or University</label>
            <input type="text" id="searchInput" placeholder="e.g. Governance, Work, Munich, Mannheim" oninput="applyJobFilters()">
          </div>
          <div class="filter-group">
            <label for="typeSelect">Opportunity Category</label>
            <select id="typeSelect" onchange="applyJobFilters()">
              <option value="ALL">All Ready-to-Apply (Live Jobs + PhD Courses)</option>
              <option value="Live Vacancy">Live Job Vacancies Only</option>
              <option value="Structured PhD Program">Verified University PhD Programs Only</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="stateSelect">Federal State</label>
            <select id="stateSelect" onchange="applyJobFilters()">
              <option value="">All Western States</option>
              <option value="West">West Germany Only (Non-DDR)</option>
              <option value="Baden-Württemberg">Baden-Württemberg</option>
              <option value="Bayern">Bavaria</option>
              <option value="Nordrhein-Westfalen">North Rhine-Westphalia</option>
              <option value="Hessen">Hesse</option>
              <option value="Niedersachsen">Lower Saxony</option>
              <option value="Hamburg">Hamburg</option>
              <option value="Bremen">Bremen</option>
              <option value="Rheinland-Pfalz">Rhineland-Palatinate</option>
              <option value="Schleswig-Holstein">Schleswig-Holstein</option>
              <option value="Saarland">Saarland</option>
            </select>
          </div>
        </div>
        <div class="checkbox-row">
          <div class="checkbox-group">
            <input type="checkbox" id="verifiedOnlyCheck" checked onchange="applyJobFilters()">
            <label for="verifiedOnlyCheck">Hide Rejected Listings (Show Ready-to-Apply Only)</label>
          </div>
          <div class="checkbox-group">
            <input type="checkbox" id="westOnlyCheck" checked onchange="applyJobFilters()">
            <label for="westOnlyCheck">Exclude Former DDR States</label>
          </div>
          <div class="checkbox-group">
            <input type="checkbox" id="englishOnlyCheck" checked onchange="applyJobFilters()">
            <label for="englishOnlyCheck">English Preferred Only</label>
          </div>
        </div>
      </div>

      <div class="stats" id="jobsStatsBar">Showing 0 positions</div>

      <div class="jobs-table-wrapper">
        <table>
          <thead>
            <tr>
              <th style="width: 32%;">Position / Course & Full-Page Verification</th>
              <th style="width: 17%;">Institution & Region</th>
              <th style="width: 21%;">Eligibility & Pay Details</th>
              <th style="width: 13%;">Keywords</th>
              <th style="width: 17%;">Window, Deadline & Action</th>
            </tr>
          </thead>
          <tbody id="jobsTableBody">
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 2: 44 UNIVERSITIES DIRECTORY -->
    <div id="unisTab" class="tab-content">
      <div class="actions-bar">
        <a href="/api/export-universities" class="btn btn-primary" id="exportUnisBtn" download="western_german_universities.csv">
          Download 44 Universities (CSV)
        </a>
      </div>

      <div class="filters-card">
        <div class="filters-grid">
          <div class="filter-group">
            <label for="uniSearchInput">Search Institution or Professor</label>
            <input type="text" id="uniSearchInput" placeholder="e.g. Cologne, Andresen, Mannheim" oninput="applyUniFilters()">
          </div>
          <div class="filter-group">
            <label for="uniStateSelect">Federal State</label>
            <select id="uniStateSelect" onchange="applyUniFilters()">
              <option value="">All 10 Western States</option>
              <option value="Baden-Württemberg">Baden-Württemberg</option>
              <option value="Bayern">Bavaria</option>
              <option value="Nordrhein-Westfalen">North Rhine-Westphalia</option>
              <option value="Hessen">Hesse</option>
              <option value="Niedersachsen">Lower Saxony</option>
              <option value="Hamburg">Hamburg</option>
              <option value="Bremen">Bremen</option>
              <option value="Rheinland-Pfalz">Rhineland-Palatinate</option>
              <option value="Schleswig-Holstein">Schleswig-Holstein</option>
              <option value="Saarland">Saarland</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="uniPathwaySelect">Doctoral Pathway</label>
            <select id="uniPathwaySelect" onchange="applyUniFilters()">
              <option value="">All Pathways</option>
              <option value="Structured">Structured (100% English Program)</option>
              <option value="Individual">Individual Promotion (Chair Agreement)</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="uniFieldSelect">Target Discipline</label>
            <select id="uniFieldSelect" onchange="applyUniFilters()">
              <option value="">All Disciplines</option>
              <option value="Human Resource">Human Resource Management (HRM)</option>
              <option value="Industrial Relations">Industrial Relations / Labor Studies</option>
              <option value="International Relations">International Relations (IR)</option>
            </select>
          </div>
        </div>
      </div>

      <div class="stats" id="unisStatsBar">Showing 0 institutions</div>

      <div id="unisContainer"></div>
    </div>

    <!-- TAB 3: EXTERNAL SEARCH PORTALS -->
    <div id="portalsTab" class="tab-content">
      <div class="portal-grid">
        <div class="portal-card">
          <div>
            <h3>EURAXESS Germany (R1 PhD)</h3>
            <p>Official European Commission portal for English R1 doctoral positions in Germany.</p>
          </div>
          <a href="https://euraxess.ec.europa.eu/jobs/search?f%5B0%5D=job_country%3A794&f%5B1%5D=job_research_profile%3A447" target="_blank" rel="noopener" class="btn btn-secondary">
            Open EURAXESS R1 Jobs &rarr;
          </a>
        </div>

        <div class="portal-card">
          <div>
            <h3>Academics.com / Academics.de</h3>
            <p>The leading German academic job portal published by DIE ZEIT. Filter for PhD in Social Sciences.</p>
          </div>
          <a href="https://www.academics.com/" target="_blank" rel="noopener" class="btn btn-secondary">
            Open Academics Portal &rarr;
          </a>
        </div>

        <div class="portal-card">
          <div>
            <h3>DAAD International Programmes</h3>
            <p>Official DAAD catalog of 100% English structured doctoral programs across Germany.</p>
          </div>
          <a href="https://www2.daad.de/deutschland/studienangebote/international-programmes/en/" target="_blank" rel="noopener" class="btn btn-secondary">
            Open DAAD Catalog &rarr;
          </a>
        </div>

        <div class="portal-card">
          <div>
            <h3>Hochschulkompass</h3>
            <p>German Rectors' Conference database of every accredited doctoral study program.</p>
          </div>
          <a href="https://www.hochschulkompass.de/en/doctoral-studies.html" target="_blank" rel="noopener" class="btn btn-secondary">
            Open Hochschulkompass &rarr;
          </a>
        </div>

        <div class="portal-card">
          <div>
            <h3>Anabin Degree Verification</h3>
            <p>Verify that your Nigerian university holds an H+ status for official recognition in Germany.</p>
          </div>
          <a href="https://anabin.kmk.org/cms/public/startseite" target="_blank" rel="noopener" class="btn btn-secondary">
            Open Anabin Database &rarr;
          </a>
        </div>

        <div class="portal-card">
          <div>
            <h3>ZAB Comparability Statement</h3>
            <p>Central Office for Foreign Education: request an official Statement of Comparability for Master's degrees.</p>
          </div>
          <a href="https://www.kmk.org/zab/central-office-for-foreign-education.html" target="_blank" rel="noopener" class="btn btn-secondary">
            Open ZAB Website &rarr;
          </a>
        </div>
      </div>
    </div>
  </div>

  <script>
    const allPositions = ${jsonPositions};
    const allUniversities = ${jsonUniversities};
    const allEnglishJobs = ${jsonEnglishJobs};

    function formatStateEnglish(state) {
      const map = {
        'Bayern': 'Bavaria',
        'Nordrhein-Westfalen': 'North Rhine-Westphalia',
        'Hessen': 'Hesse',
        'Niedersachsen': 'Lower Saxony',
        'Rheinland-Pfalz': 'Rhineland-Palatinate',
        'Sachsen': 'Saxony',
        'Sachsen-Anhalt': 'Saxony-Anhalt',
        'Thüringen': 'Thuringia',
        'Mecklenburg-Vorpommern': 'Mecklenburg-Western Pomerania',
      };
      return map[state] || state;
    }

    function initGottingenKpis() {
      const total = allEnglishJobs.length;
      const local = allEnglishJobs.filter(j => j.workplaceLocation.toLowerCase().includes('göttingen') || j.workplaceLocation.toLowerCase().includes('goettingen')).length;
      const remote = total - local;

      const elTotal = document.getElementById('kpiGottingenTotal');
      const elLocal = document.getElementById('kpiGottingenLocal');
      const elRemote = document.getElementById('kpiGottingenRemote');

      if (elTotal) elTotal.textContent = String(total);
      if (elLocal) elLocal.textContent = String(local);
      if (elRemote) elRemote.textContent = String(remote);
    }

    function applyGottingenFilters() {
      const search = (document.getElementById('gottingenSearchInput')?.value || '').toLowerCase().trim();
      const locFilter = document.getElementById('gottingenLocationSelect')?.value || 'ALL';
      const catFilter = document.getElementById('gottingenCategorySelect')?.value || 'ALL';

      const filtered = allEnglishJobs.filter(j => {
        const isGoe = j.workplaceLocation.toLowerCase().includes('göttingen') || j.workplaceLocation.toLowerCase().includes('goettingen');
        if (locFilter === 'GÖTTINGEN' && !isGoe) return false;
        if (locFilter === 'REMOTE' && isGoe) return false;

        if (catFilter !== 'ALL' && j.category !== catFilter) return false;

        if (search) {
          const matchText = (j.jobTitle + ' ' + j.employer + ' ' + j.workplaceLocation + ' ' + j.category + ' ' + j.fitAssessment).toLowerCase();
          if (!matchText.includes(search)) return false;
        }

        return true;
      });

      renderGottingenTable(filtered);
    }

    function renderGottingenTable(jobs) {
      const tbody = document.getElementById('gottingenTableBody');
      const stats = document.getElementById('gottingenStatsBar');
      if (!tbody || !stats) return;

      stats.textContent = 'Showing ' + jobs.length + ' verified positions (Total pool: ' + allEnglishJobs.length + ')';

      if (jobs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 32px; color: #64748b;">No matching jobs found. Try adjusting your search query or filters above.</td></tr>';
        return;
      }

      tbody.innerHTML = jobs.map((j, idx) => {
        const isGoe = j.workplaceLocation.toLowerCase().includes('göttingen') || j.workplaceLocation.toLowerCase().includes('goettingen');
        const locBadge = isGoe
          ? '<span class="badge badge-west">Göttingen</span>'
          : '<span class="badge badge-pathway">100% Remote Germany</span>';

        return '<tr>' +
          '<td data-label="#"><strong>' + (idx + 1) + '</strong></td>' +
          '<td data-label="Job Title">' +
            '<a href="' + j.directApplicationLink + '" target="_blank" rel="noopener" class="job-title">' + j.jobTitle + '</a>' +
            '<div class="job-meta" style="font-weight: 600; color: #1e3a8a;">' + j.employer + '</div>' +
          '</td>' +
          '<td data-label="Location">' +
            locBadge +
            '<div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 4px;">' + j.workplaceLocation + '</div>' +
          '</td>' +
          '<td data-label="Category"><span class="badge badge-tag">' + j.category + '</span></td>' +
          '<td data-label="Fit Assessment">' +
            '<div class="ai-detail-line" style="font-size: 0.85rem; line-height: 1.4;">' + j.fitAssessment + '</div>' +
          '</td>' +
          '<td data-label="Action">' +
            '<a href="' + j.directApplicationLink + '" target="_blank" rel="noopener" class="btn btn-primary" style="min-height: 36px; padding: 6px 12px; font-size: 0.85rem; display: inline-flex; align-items: center; justify-content: center; gap: 4px;">Apply Direct &rarr;</a>' +
          '</td>' +
        '</tr>';
      }).join('');
    }

    function initKpis() {
      const ready = allPositions.filter(p => p.verificationStatus !== 'Rejected');
      const liveReady = ready.filter(p => (p.opportunityType || 'Live Vacancy') === 'Live Vacancy');
      const progReady = ready.filter(p => p.opportunityType === 'Structured PhD Program');
      const rejected = allPositions.filter(p => p.verificationStatus === 'Rejected');

      document.getElementById('kpiReadyCount').textContent = String(ready.length);
      document.getElementById('kpiLiveCount').textContent = String(liveReady.length);
      document.getElementById('kpiProgramCount').textContent = String(progReady.length);
      document.getElementById('kpiRejectedCount').textContent = String(rejected.length);

      try {
        const savedKey = localStorage.getItem('phd_gemini_api_key') || '';
        if (savedKey) {
          document.getElementById('geminiKeyInput').value = savedKey;
        }
      } catch (e) {}
    }

    function saveGeminiKey() {
      try {
        const val = document.getElementById('geminiKeyInput').value.trim();
        localStorage.setItem('phd_gemini_api_key', val);
      } catch (e) {}
    }

    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

      const activeBtn = document.querySelector('[data-tab="' + tabId + '"]');
      if (activeBtn) activeBtn.classList.add('active');
      const targetContent = document.getElementById(tabId);
      if (targetContent) targetContent.classList.add('active');
      window.location.hash = '#' + tabId;
    }

    function applyJobFilters() {
      const search = document.getElementById('searchInput').value.toLowerCase();
      const typeFilter = document.getElementById('typeSelect').value;
      const stateFilter = document.getElementById('stateSelect').value;
      const verifiedOnly = document.getElementById('verifiedOnlyCheck').checked;
      const westOnly = document.getElementById('westOnlyCheck').checked;
      const englishOnly = document.getElementById('englishOnlyCheck').checked;

      const filtered = allPositions.filter(p => {
        if (verifiedOnly && p.verificationStatus === 'Rejected') return false;
        if (westOnly && !p.isWestGermany) return false;
        if (englishOnly && !p.isEnglishPreferred) return false;

        if (typeFilter !== 'ALL') {
          const pType = p.opportunityType || 'Live Vacancy';
          if (pType !== typeFilter) return false;
        }

        if (stateFilter) {
          if (stateFilter === 'West' && !p.isWestGermany) return false;
          if (stateFilter !== 'West' && p.state !== stateFilter) return false;
        }

        if (search) {
          const matchText = (
            p.title + ' ' +
            p.employer + ' ' +
            p.location + ' ' +
            (p.aiSummary || '') + ' ' +
            (p.degreeFit || '') + ' ' +
            p.matchedKeywords.join(' ')
          ).toLowerCase();
          if (!matchText.includes(search)) return false;
        }

        return true;
      });

      renderJobsTable(filtered);
    }

    function renderJobsTable(positions) {
      const tbody = document.getElementById('jobsTableBody');
      const stats = document.getElementById('jobsStatsBar');
      const readyTotal = allPositions.filter(p => p.verificationStatus !== 'Rejected').length;
      const rejectedTotal = allPositions.filter(p => p.verificationStatus === 'Rejected').length;

      stats.textContent =
        'Showing ' + positions.length + ' verified opportunities (Ready to apply: ' + readyTotal +
        ' | Auto-rejected after detail page inspection: ' + rejectedTotal + ')';

      if (positions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 32px; color: #64748b;">No matching positions found. Adjust your filters above.</td></tr>';
        return;
      }

      tbody.innerHTML = positions.map(p => {
        const isRejected = p.verificationStatus === 'Rejected';
        const isUnverified = p.verificationStatus === 'Unverified';
        const scoreText = p.matchScore !== undefined ? p.matchScore + '% Match' : 'Verified';
        const statusBadge = isRejected
          ? '<span class="badge badge-ddr">Rejected (' + scoreText + ')</span>'
          : isUnverified
          ? '<span class="badge" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;">Unverified (Review Needed)</span>'
          : '<span class="badge badge-west">Verified Match (' + scoreText + ')</span>';

        const typeBadge = p.opportunityType === 'Structured PhD Program'
          ? '<span class="badge badge-pathway">Structured 100% English PhD Course</span>'
          : '<span class="badge badge-pathway">Live Funded PhD Vacancy</span>';

        const regionBadge = p.isWestGermany
          ? '<span class="badge badge-west">West Germany</span>'
          : '<span class="badge badge-ddr">Former DDR / Berlin</span>';

        const keywordsHtml = p.matchedKeywords.length > 0
          ? p.matchedKeywords.map(k => '<span class="badge badge-tag">' + k + '</span>').join('')
          : '<span class="badge badge-tag">Doctoral</span>';

        const summaryHtml = p.aiSummary
          ? '<div class="ai-box' + (isRejected ? ' rejected' : '') + '">' +
              '<strong>' + (p.evaluatedBy || 'Deep Page Inspector') + ':</strong> ' + p.aiSummary +
            '</div>'
          : '';

        return '<tr>' +
          '<td data-label="Title">' +
            '<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:6px;">' +
              statusBadge + typeBadge +
            '</div>' +
            '<a href="' + p.link + '" target="_blank" rel="noopener" class="job-title">' + p.title + '</a>' +
            '<div class="job-meta">Source: ' + p.source + ' | Published: ' + (p.publicationDate || 'Current') + '</div>' +
            summaryHtml +
          '</td>' +
          '<td data-label="Employer">' +
            '<div style="font-weight: 600;">' + p.employer + '</div>' +
            '<div class="ai-detail-line">' + p.location + ' (' + formatStateEnglish(p.state) + ')</div>' +
            '<div style="margin-top: 6px;">' + regionBadge + '</div>' +
          '</td>' +
          '<td data-label="Eligibility">' +
            '<div class="ai-detail-line"><strong>Degrees:</strong> ' + (p.degreeFit || 'Social Sciences / IR / HRM') + '</div>' +
            '<div class="ai-detail-line"><strong>Language:</strong> ' + (p.languageRequirement || 'English') + '</div>' +
            '<div class="ai-detail-line"><strong>Pay:</strong> ' + (p.compensation || 'Paid TV-L E13') + '</div>' +
          '</td>' +
          '<td data-label="Keywords">' + keywordsHtml + '</td>' +
          '<td data-label="Apply">' +
            '<div class="ai-detail-line" style="margin-bottom:4px;"><strong>Window:</strong> ' + (p.applicationWindow || p.publicationDate || 'Open now') + '</div>' +
            '<div style="font-size:0.82rem; font-weight:600; margin-bottom:8px;"><strong>Deadline:</strong> ' + (p.deadline || 'Open until filled') + '</div>' +
            '<a href="' + p.link + '" target="_blank" rel="noopener" class="btn btn-primary" style="min-height: 36px; padding: 6px 12px; font-size: 0.85rem;">Apply / View &rarr;</a>' +
          '</td>' +
        '</tr>';
      }).join('');
    }

    function applyUniFilters() {
      const search = document.getElementById('uniSearchInput').value.toLowerCase();
      const stateFilter = document.getElementById('uniStateSelect').value;
      const pathwayFilter = document.getElementById('uniPathwaySelect').value;
      const fieldFilter = document.getElementById('uniFieldSelect').value.toLowerCase();

      const filtered = allUniversities.filter(u => {
        if (stateFilter && u.state !== stateFilter) return false;
        if (pathwayFilter && !u.pathway.toLowerCase().includes(pathwayFilter.toLowerCase())) return false;
        if (fieldFilter && !u.fields.some(f => f.toLowerCase().includes(fieldFilter))) return false;

        if (search) {
          const matchText = (u.name + ' ' + u.location + ' ' + u.state + ' ' + u.program + ' ' + u.verifiedProfessorsSummary + ' ' + u.fields.join(' ')).toLowerCase();
          if (!matchText.includes(search)) return false;
        }

        return true;
      });

      renderUnis(filtered);
    }

    function renderUnis(universities) {
      const container = document.getElementById('unisContainer');
      const stats = document.getElementById('unisStatsBar');

      stats.textContent = 'Showing ' + universities.length + ' institutions (Total directory: ' + allUniversities.length + ')';

      if (universities.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 32px; color: #64748b; background: white; border-radius: 12px; border: 1px solid var(--border);">No matching institutions found for these filters.</div>';
        return;
      }

      container.innerHTML = universities.map(u => {
        const urlPills = u.urls.map(url => 
          '<a href="' + url.url + '" target="_blank" rel="noopener" class="url-pill">' + url.label + ' &rarr;</a>'
        ).join('');

        const fieldsBadges = u.fields.map(f => '<span class="badge badge-tag">' + f + '</span>').join('');

        return '<div class="uni-card">' +
          '<div class="uni-header">' +
            '<div>' +
              '<div class="uni-title">' + u.id + '. ' + u.name + '</div>' +
              '<div class="uni-meta-row" style="margin-top: 6px;">' +
                '<span class="badge badge-west">' + formatStateEnglish(u.state) + '</span>' +
                '<span class="badge badge-pathway">' + u.pathway + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="uni-section-title">Program / Department</div>' +
          '<div class="uni-text">' + u.program + '</div>' +
          '<div class="uni-section-title">Fields of Research</div>' +
          '<div style="margin-bottom: 8px;">' + fieldsBadges + '</div>' +
          '<div class="uni-section-title">English Language Policy</div>' +
          '<div class="uni-text">' + u.languagePolicy + '</div>' +
          '<div class="uni-section-title">Funding Model</div>' +
          '<div class="uni-text">' + u.funding + '</div>' +
          '<div class="uni-section-title">Application Window & Deadline</div>' +
          '<div class="uni-text"><strong>Window:</strong> ' + (u.applicationWindow || 'Year-round / Rolling') + ' | <strong>Deadline:</strong> ' + (u.deadline || 'Rolling') + '</div>' +
          '<div class="uni-section-title">Verified Professors / Chairs</div>' +
          '<div class="uni-text" style="font-weight: 500;">' + u.verifiedProfessorsSummary + '</div>' +
          '<div class="uni-section-title">Official Verification Links</div>' +
          '<div class="links-list">' + urlPills + '</div>' +
        '</div>';
      }).join('');
    }

    async function runScan() {
      const btn = document.getElementById('refreshBtn');
      btn.textContent = 'Scanning & Verifying Detail Pages...';
      btn.disabled = true;

      try {
        const headers = {};
        const keyInput = document.getElementById('geminiKeyInput');
        if (keyInput && keyInput.value.trim()) {
          headers['x-gemini-api-key'] = keyInput.value.trim();
        }
        const res = await fetch('/api/scan', { method: 'POST', headers });
        if (res.ok) {
          window.location.reload();
        } else {
          alert('Scan failed. Please check internet connection and try again.');
        }
      } catch (err) {
        alert('Network error during scan.');
      } finally {
        btn.textContent = 'Scan Feed Websites Now';
        btn.disabled = false;
      }
    }

    // Initial renders
    initGottingenKpis();
    applyGottingenFilters();
    initKpis();
    applyJobFilters();
    applyUniFilters();

    if (window.location.hash) {
      const hashId = window.location.hash.substring(1);
      if (document.getElementById(hashId)) {
        switchTab(hashId);
      }
    }
  </script>
</body>
</html>`;
}
