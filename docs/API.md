# Dokumentasi Service & API Layer — ScopeLens

Seluruh komunikasi data dibungkus dalam `src/services/` menggunakan Supabase JS Client dan RPC PostgreSQL.

## 1. Auth Service (`src/services/authService.ts`)
- `registerUser(email, password, fullName)`
- `loginUser(email, password)`
- `logoutUser()`
- `requestPasswordReset(email)`
- `getCurrentSession()`
- `getUserProfile(userId)` / `updateUserProfile(userId, fullName)`

## 2. Project Service (`src/services/projectService.ts`)
- `createProject(input)`
- `getProjects({ page, pageSize })` — mendukung pagination dan query batch `scope_items` (tanpa N+1 query).
- `getProjectById(projectId)`
- `updateProject(projectId, patch)`
- `deleteProject(projectId)`
- `saveProjectWorkspace(project)` — memanggil RPC PostgreSQL `save_project_workspace` secara atomik.

## 3. Scope Service (`src/services/scopeService.ts`)
- `createScopeItem(projectId, item)`
- `updateScopeItem(itemId, patch)`
- `deleteScopeItem(itemId)`
- `getOriginalScope(projectId)`
- `getRequestedScope(projectId)`
- `compareScope(project)` — menjalankan `analyzeProjectScope()` dari engine.

## 4. Negotiation Service (`src/services/negotiationService.ts`)
- `calculateNegotiation(project, strategyOverride?)`
- `createNegotiation(project, notes)` — memanggil RPC `save_negotiation_with_items`.
- `getNegotiations(projectId)`
- `getNegotiationById(negotiationId)`
- `updateNegotiation(negotiationId, patch)`
- `deleteNegotiation(negotiationId)`

## 5. Report Service (`src/services/reportService.ts`)
- `createReportSnapshot(project, options)` — menyimpan ke `project_reports` (Cloud) atau `localStorage` (Demo Mode).
- `getProjectReports(projectId, options)`
- `getReportById(reportId, isAuthenticated)`
