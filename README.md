# Germany PhD Position Scanner & University Directory

This system automates the search for paid doctoral positions in western German federal states.
It focuses on International Relations (IR), Industrial Relations (Labor Studies), and Human Resource Management (HRM).
It supports deployment to **Cloudflare Workers** and **Node.js** servers.

---

## Features

1. **Automatic Feed Scanner:**
   - Scans official German public sector and academic feeds (`service.bund.de` and `myscience.de`).
   - Runs a daily scheduled cron task (`0 8 * * *`).

2. **Geographical Filter (Outside Former DDR):**
   - Detects German postal codes (PLZ) and federal states.
   - Includes western federal states (Baden-Württemberg, Bayern, Nordrhein-Westfalen, Hessen, Niedersachsen, Hamburg, Bremen, Rheinland-Pfalz, Schleswig-Holstein, Saarland).
   - Excludes the five eastern federal states (Sachsen, Sachsen-Anhalt, Thüringen, Brandenburg, Mecklenburg-Vorpommern) and Berlin.

3. **Keyword and Language Matcher:**
   - Matches PhD positions (*Doktorand*, *Wissenschaftliche/r Mitarbeiter/in*, *TV-L E13*).
   - Matches target subjects (Industrial Relations, Human Resource Management, Labor Relations, International Relations, Social Sciences).
   - Flags positions where English is preferred.

4. **Directory of 44 Western German Universities & Verified Professors:**
   - Embedded directory of all 44 institutions outside the former DDR.
   - Categorized by Doctoral Pathway (Structured 100% English Programs vs Individual Doctorates).
   - Contains direct links to official English language regulations and verified professor profile pages.

5. **Interactive Mobile-Responsive Dashboard:**
   - Multi-tab layout:
     - **Tab 1: Live Vacancies** (real-time filtering, keyword search, state filters, non-DDR toggle).
     - **Tab 2: 44 Western Universities & Professors** (filterable by Pathway, State, and Field).
     - **Tab 3: Manual Search Portals** (one-click pre-filtered search links to EURAXESS Germany, Academics, DAAD, Hochschulkompass, and Anabin).

6. **Dual Excel Exports (CSV with UTF-8 BOM):**
   - Download live PhD job vacancies (`/api/export`).
   - Download the complete 44-university and professor directory (`/api/export-universities`).

---

## Project Structure

- `src/index.ts`: Cloudflare Worker entry point.
- `src/server.ts`: Standalone Node.js server (zero dependencies, low memory footprint).
- `src/universities-data.ts`: Structured data for all 44 Western German universities and professors.
- `src/scanner.ts`: Logic to fetch feeds and parse vacancies.
- `src/geo.ts`: Postal code and German federal state detection.
- `src/filters.ts`: Keyword matching and language scoring.
- `src/parser.ts`: Safe XML and RSS feed parser.
- `src/exporter.ts`: Excel-compatible CSV generator with UTF-8 BOM.
- `src/ui.ts`: Mobile-responsive dashboard HTML with tabs.
- `tests/logic.test.ts`: Logic and unit tests.
- `tests/ui.test.ts`: UI, mobile responsiveness, and endpoint tests.
- `wrangler.jsonc`: Cloudflare Worker configuration.

---

## Commands

### 1. Run Tests
```bash
npm test
```

### 2. Run Type Check and Build
```bash
npm run build
```

### 3. Run Linter
```bash
npm run lint
```

### 4. Run Cloudflare Development Server
```bash
npm run dev
```

### 5. Deploy to Cloudflare
```bash
npm run deploy
```

---

## API Endpoints

- `GET /`: Interactive web dashboard (Tabs for Jobs, Universities, and Search Portals).
- `GET /api/jobs`: Returns the collected list of positions as JSON.
- `GET /api/export`: Downloads live jobs as an Excel CSV file.
- `GET /api/universities`: Returns all 44 universities and professors as JSON.
- `GET /api/export-universities`: Downloads all 44 universities and professors as an Excel CSV file.
- `POST /api/scan`: Forces an immediate scan of all feeds.
