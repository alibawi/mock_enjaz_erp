# ENKI ERP — Enjaz combined mock

Clickable prototype combining **الموجودات الثابتة** (Fixed Assets) and **إدارة العقود** (Contracts Management).

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run check    # assets engine check + contracts integrity check
```

- `/#/` — hub; `/#/fixed-assets/...` — fixed assets; `/#/contract-mgmt/...` — contracts.
- Each module has its own demo data, roles and reset button (separate `localStorage` keys).
- Architecture and contribution rules: [CLAUDE.md](CLAUDE.md). Per-module docs and history: `docs/assets`, `docs/contracts`.
