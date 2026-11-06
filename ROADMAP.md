# Project Roadmap

This document outlines the planned technical improvements and features for the doctoral opportunities and university finder.

## Planned Work (Estimated: 25+ Hours)

### 1. Automated Scraping Pipelines (6 Hours)
- Add recurring background jobs to refresh university directory data.
- Build retry handlers with exponential backoff for external requests.
- Add error notifications for failed ingestion runs.

### 2. Expanded Regional Coverage (5 Hours)
- Add university data for institutions in Southern and Eastern Germany.
- Integrate geo-coordinate distance filtering for neighboring European regions.
- Improve postal code resolution for small university campus locations.

### 3. Application Search and User Bookmarks (6 Hours)
- Build client-side bookmarking stored in local browser storage.
- Add full-text search with highlight matching across job titles.
- Create saved search filters for specific disciplines and salary grades.

### 4. Automated Testing and CI (5 Hours)
- Write unit tests for the position extraction parser.
- Write integration tests for SQLite and Redis cache operations.
- Add GitHub Actions workflow for automated test execution on every commit.

### 5. Documentation and OpenAPI Specs (3 Hours)
- Generate OpenAPI specification files for all HTTP API endpoints.
- Add complete deployment instructions for Cloudflare Pages and self-hosted environments.

