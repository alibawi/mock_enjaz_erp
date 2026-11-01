# CLAUDE.md — ENKI ERP (Enjaz) combined mock

One clickable prototype that merges two standalone mocks behind a single shell:

| Module | Route prefix | Source folder | Docs |
|---|---|---|---|
| الموجودات الثابتة (Fixed Assets) | `/fixed-assets` | `src/modules/assets` | `docs/assets/` |
| إدارة العقود (Contracts Management) | `/contract-mgmt` | `src/modules/contracts` | `docs/contracts/` |

Stack: Vite + React 18 + TypeScript + Tailwind v3, HashRouter, client-side stores persisted to `localStorage`.
`npm run dev` / `npm run build` / `npm run check`. Never touches the JasimERP code base.

## Layout

- `src/shell/` — the only code that knows about both modules: `Sidebar.tsx` (one sidebar, one expandable group per module), `Hub.tsx` (landing page at `/`), `routerShim.tsx`.
- `src/modules/<module>/` — the original mock, unchanged apart from the points below. `<Module>App.tsx` is the old `App.tsx` (routes), `router.tsx` is the module's router shim.
- `scripts/<module>/` — the original engine/flow checks (imports repointed). `npm run check` runs the assets engine check and the contracts integrity check; `check:contracts:<flow>` runs one flow script.

## How the merge works (read before changing anything)

1. **Modules stay isolated.** Each keeps its own `data/store.tsx`, `types`, `seed`, `ui`, `format`, `asof`, `permissions`. Nothing is shared between modules; same-named files do not collide because they live in different folders. Do not import across `src/modules/assets` ↔ `src/modules/contracts`.
2. **Two stores, two localStorage keys** (`enki-assets-mock`, the contracts key). `main.tsx` nests both providers around the router; the shell Sidebar reads the contracts store for permission/feature filtering of its menu.
3. **Absolute paths inside a module are module-relative.** Module code still writes `to="/contracts/new"` / `navigate('/assets')`. Every module file imports routing from its own `router.tsx` (never from `react-router-dom` directly), whose `Link`, `NavLink`, `Navigate`, `useNavigate` prepend the module prefix and whose `useLocation().pathname` strips it. Keep new module code on that import.
4. **Module layout** — `components/Layout.tsx` of each module exports `Topbar` and `PageHeader` only; the sidebar and page frame are the shell's. Each module's `PageHeader` crumb root still says its own module name.
5. Reset-data buttons set `window.location.hash = '#/'`, which now lands on the hub.

## Rules inherited from the module mocks (still apply, per module)

1. Component reuse: shared components live in each module's `components/`; extend with props, never duplicate.
2. Mock data only through the module store (`useStore()`); seed in `data/seed*`; business rules in `data/*.ts`.
3. Five-screen pattern per module: List → Detail → Create/Edit → Activity log → KPIs.
4. Logical properties only (`ps-`, `pe-`, `start-`, `end-`, `text-start`); Tailwind tokens (`navy`, `line`, `page`), Arabic RTL.
5. Bump `DATA_VERSION` in a module's `data/store.tsx` whenever its data model or seed changes.
6. Contracts: demo "today" comes from `data/asof.ts`, never `new Date()` in business logic; every state change goes through `run()` and appends an audit row.
7. Realistic connected data (Iraqi locale, IQD); no invented requirements — log gaps in the WORKLOG and ask.
8. Conventional Commits, scope = module: `feat(assets): …`, `feat(contracts): …`, `chore(shell): …`.
9. **WORKLOG.md** — read from the top before work; append an entry after every task; append-only. The root `WORKLOG.md` covers shell/merge work; per-module history is in `docs/<module>/WORKLOG.md` (append module work there).

Original per-module instructions are preserved in `docs/<module>/CLAUDE.module.md`.
