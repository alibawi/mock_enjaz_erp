# CLAUDE.md — ENKI ERP Contracts Management mock

Clickable prototype of the Contracts Management (إدارة العقود) module. Source of truth for behaviour: the plan documents in
`docs/source/contracts-plan/` (00–15). Method: `docs/source/mock-playbook-en.md`. Decisions: `docs/project-brief.md`.
Roadmap, specs and prompts: `docs/roadmap.md`, `docs/spec-<module>.md`, `docs/prompts-<module>.md`.

Stack (same deviation from playbook §2 as `D:\Projects\Git\Mocks\assets_mock`, see WORKLOG): Vite + React 18 + TypeScript + Tailwind v3,
client-side store persisted to `localStorage` (`src/data/store.tsx`), HashRouter. `npm run dev` / `npm run build` / `npm run check`.
This repo never touches the JasimERP code base.

## Mandatory rules (playbook §5)

1. **Component reuse.** Every screen uses the shared components in `src/components/`. If a variation is needed, extend the shared component with props — never duplicate it. No generic UI components inside `src/pages/<module>/`.
2. **Mock data through the store only.** Seed data lives in `src/data/seed/` and is read exclusively through `useStore()` / `mockApi`; business rules live in `src/data/*.ts` (`lifecycle.ts`, `fulfillment.ts`, `approval.ts`, `currency.ts`, `settings.ts`). Pages never hard-code data arrays.
3. **Five-screen pattern per module:** List → Detail → Create/Edit → Activity log / Audit trail → Module KPIs.
4. **Theme and direction safety.** Use logical properties (`ps-`, `pe-`, `start-`, `end-`, `text-start`) instead of `pl-`, `pr-`, `left-`, `right-`. Colours come from Tailwind theme tokens (`navy`, `line`, `page`) — no raw hex in components. Arabic only, RTL.
5. **WORKLOG.md.** Read it from the top before any work. After every task, append an entry at the bottom. Append-only — never edit or delete past entries.
6. **Realistic, connected data.** Iraqi locale, IQD (and USD for currency tests), real-looking but fictional names; entities reference each other by ID.
7. **Small commits.** Conventional Commits: `feat(<module>): ...`, `fix: ...`, `chore: ...`, `docs: ...`. Commit locally after each step; do not push.
8. **No invented requirements.** If the plan is silent or contradictory, log it in WORKLOG and ask.

## Project conventions

- Demo "today" comes from `asof.ts` (`today()`), never `new Date()` in business logic, so expiry/reminders/overdue are testable.
- Settings that change behaviour (`src/data/settings.ts`) are read at action time, not captured at import time.
- Every state-changing action appends an audit row (`db.audit`) and goes through `run()` in the store.
- Simulated modules of other systems (Sales, Procurement, Inventory, Elsa, DMS, e-signature provider) are labelled «محاكاة» in the UI.
