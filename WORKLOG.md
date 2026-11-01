# WORKLOG — mock_enjaz_erp (shell / merge)

Append-only. Module-level history: `docs/assets/WORKLOG.md`, `docs/contracts/WORKLOG.md`.

## 2026-11-01 — Merge assets_mock + contract_managment into one mock

- Copied `assets_mock/src` → `src/modules/assets`, `contract_managment/src` → `src/modules/contracts`; scripts → `scripts/<module>/` (imports repointed); docs, READMEs and WORKLOGs → `docs/<module>/`; original CLAUDE.md files → `docs/<module>/CLAUDE.module.md`. `node_modules`, `dist` and `.git` of the originals were not copied (no git history carried over).
- Both mocks had identical dependency sets and identical tailwind/vite/postcss/tsconfig, so one `package.json` serves both. Scripts renamed: `check:assets`, `check:contracts`, `check:contracts:<flow>`, `check` = both main checks. Package name `enjaz-erp-mock`.
- Route collisions (`/`, `/settings`, `/reports`) solved by mounting each module under a prefix (`/fixed-assets`, `/contract-mgmt`) with a per-module router shim (`src/shell/routerShim.tsx`) so module code keeps its absolute paths. The only edits inside modules: `react-router-dom` imports → module `router.tsx`; `App.tsx` → `<Module>App.tsx` (topbar + routes, no layout); `Layout.tsx` stripped of Sidebar/AppLayout (exports `Topbar`, `PageHeader`).
- New shell: single sidebar with both module groups (active group auto-opens), hub landing page at `/`, unknown paths redirect to `/`.
- Stores stay separate (two localStorage keys, two seeds, independent DATA_VERSION). `index.css` taken from contracts (superset: adds print rules).
- Verified: `tsc -b` clean, `npm run build` OK, `npm run check` + all 7 contracts flow checks pass, browser pass over 16 routes (all links prefixed, no error boundaries, console clean), `navigate()` calls from both topbars resolve under the right prefix.
- Known/not done: no deduplication of the near-identical `ui`/`Layout`/`format` code between modules (kept isolated on purpose); single JS chunk ~970 kB (no code-splitting); the shell topbar is module-specific, so the hub has no role/search controls.
