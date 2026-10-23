# Leanback Operations Console — UI

React + TypeScript dashboard for the Leanback IFE webtools
integration. Lets operators send push notifications, configure webview
experiences, toggle feature flags, manage media withdrawals, and push
runtime settings to the aircraft.

Mirrors the page structure of the modular-interactive-seatback
console (Notifications, WebView, Config, Theme) plus an extra
**Search Dashboard** tab that surfaces the search analytics the
seatback SearchAnalyticsBridge forwards via LbAnalytics + HMS.

## Develop

```bash
npm install
npm run dev
# open http://localhost:5173
```

The Vite dev server proxies `/api/**` calls to `http://localhost:8080`
(see `vite.config.ts`). Configure the Spring backend with:

```bash
cd ../ops-console/server
mvn spring-boot:run
```

## Build for production

```bash
npm run build
```

Outputs the static bundle to `dist/`. Point the Spring server's
static-resource handler at `dist/` (or copy it into
`ops-console/server/src/main/resources/static/`) to serve the UI from
the same origin as the API.

## Pages

| Page | Source | Purpose |
|------|--------|---------|
| Notifications | `pages/Notifications.tsx` | Send + list push notifications |
| WebView | `pages/WebView.tsx` | Manage WebView experiences (modal/full-screen) |
| Config | `pages/Config.tsx` | Toggle feature flags, withdraw media, push settings |
| Theme | `pages/Theme.tsx` | Manage color-token themes |
| Search Dashboard | `pages/SearchDashboard.tsx` | Per-subtype search analytics |

## Wire contract

See `ops-console/server/src/main/resources/schema.json` for the
canonical wire schema. The TypeScript types in `src/types.ts` mirror
the schema and the Kotlin data classes in
`applib/src/main/java/aero/panasonic/interactive/seatback/ops/api/`.
