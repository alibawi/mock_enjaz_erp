# Roadmap — Contracts Management mock

Source: `docs/source/contracts-plan/` (plan documents 00–15) and `docs/source/mock-playbook-en.md` (method). Decisions: `docs/project-brief.md` (confirmed). Progress log: `WORKLOG.md` (created in foundation step 0.2).
Reference mock for look and stack: `D:\Projects\Git\Mocks\assets_mock`. Nothing in this repo touches JasimERP.

## Architecture
- Vite + React 18 + TypeScript + Tailwind v3, HashRouter, `lucide-react`; client-side store in `localStorage` (resettable), seeded from `src/data/seed/*.ts`.
- `src/data/` — `types.ts`, `store.tsx` (`useStore()`), `lifecycle.ts` (state machine and transition guards, plan doc 03), `fulfillment.ts` (ledger/contribution engine, doc 08), `approval.ts` (Elsa stage simulation, doc 09), `currency.ts` (conversion, ADR-18), `settings.ts` (system settings that change behaviour, ADR-17/25), `permissions.ts`, `asof.ts` (demo "today" so reminders and expiry are testable), `seed/`.
- `src/components/` — shell `Layout`, UI kit, `ListView`, `DataTable`, `StatusBadge`, `KPICard`, `Modal`, `Timeline`, `FormField`, `EmptyState`, `ErrorState`, `LoadingSkeleton`, `FilterSelect`, `SearchableSelect`, `EntityPicker`s, `ChipListEditor`, attachment mock, `StageTimeline`, `BalanceBar`, `ModuleScreensGrid`.
- `src/pages/` — one folder per module.
- Mock "API": the store exposes async functions with a simulated 300–600 ms latency (`mockApi`), so loading/empty/error states are real.

## Modules (nine) and build order (by dependency)
| # | Module | Why in this position |
|---|---|---|
| F | Foundation 0.1–0.9 | Everything depends on it |
| 1 | **contracts** — types, list, card, lifecycle, parties, attachments, signatures, links, renewal, alerts | The core entity; all other modules hang off the card |
| 2 | **workflow** — Elsa approval simulation, my tasks, delegation, e-signature simulation | Needed to move a contract Draft → Approved → Active in a demo |
| 3 | **agreements** — sales/purchase lines, commitments, ledger, balances, linked documents, currency, schedules, bonus | Most demo-visible business logic; depends on contracts and settings |
| 4 | **amendments** — amendments, versions, compare, renewal successor/auto-renew | Depends on a lifecycle and on lines |
| 5 | **obligations-finance** — obligations, milestones, penalties, payment schedule, billing automation, financial summary | Depends on contracts/agreements |
| 6 | **templates-print** — templates, clause library, contract terms, print preview | Depends on contracts and amendments (terms are versioned) |
| 7 | **service** — service contracts, coverage, SLA, covered items, consumption | Depends on contracts; independent of 3–6 |
| 8 | **settings-access** — system settings, permission matrix, numbering, approval stage table | Cross-cutting; settings store exists from F, screens last |
| 9 | **analytics** — dashboard, reports R-01…R-17, global search | Last: reads every module |

Phase 5 (polish): global search, unified alerts, executive dashboard hardening, realism review (no empty screens, zero console errors), light-only theme walkthrough.

## Foundation (playbook §8, adapted to the assets_mock stack)
| Step | Content | Commit |
|---|---|---|
| 0.1 | Vite project, folders, `CLAUDE.md` (mandatory rules) | `chore: scaffold project` |
| 0.2 | `WORKLOG.md` with rules header | `docs: worklog` |
| 0.3 | Tailwind tokens from assets_mock (navy/page/line), fonts, RTL base | `feat: design tokens` |
| 0.4 | Copy and generalise shell (`Layout`: ENKI sidebar with all ENKI modules, contracts active; top bar; breadcrumbs) | `feat: app shell` |
| 0.5 | Role switcher + `permissions.ts` + `asof.ts` demo date control | `feat: roles and demo date` |
| 0.6 | UI kit: the full component list above | `feat: component library` |
| 0.7 | Store + `mockApi` (latency, error simulation switch) + reset button | `feat: store and mock api` |
| 0.8 | Seed skeleton (partners, items, users, currencies, rates) + `settings.ts` defaults | `feat: shared seed data` |
| 0.9 | Health screen / smoke checks | `chore: foundation checkpoint` |
**Checkpoint after 0.9:** you verify the shell in the browser (sidebar, role switcher, demo date, reset) before module 1.

## Module sequence (playbook §9, per module)
1 scaffold routes + sidebar links → 2 seed data + mock API → 3 list screen → 4 detail screen → 5 state machine and rules → 6 create/edit forms and modals → 7 module-specific screens → 8 permissions touchpoints → 9 module KPIs → 10 full flow test in the browser. **Stop after each module for review.**

## Rough time estimate (one developer-day ≈ one focused session)
Foundation 1.5 d · contracts 3 · workflow 2 · agreements 4 · amendments 2 · obligations-finance 3 · templates-print 2.5 · service 2 · settings-access 1.5 · analytics 2.5 · polish 2 ⇒ about 26 working days.

## Risks
- Breadth: all four tracks complete; mitigation: strict module order and checkpoints; shared components first.
- Connected seed data across nine modules; mitigation: one seed owner file per entity family and an integrity script (`npm run check`, like assets_mock) that validates foreign keys and ledger = balances.
- Plan items marked conditional in the plan (service integration, e-signature provider, category membership service) are mocked as placeholders and listed in each spec §7.
