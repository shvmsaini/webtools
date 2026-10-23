# Operations Console

A Spring Boot + React operator dashboard for the **Leanback IFE**
seatback. Mirrors the contract from the modular-interactive-seatback
webtools module so the Android consumer can be plugged in without
modification.

## Architecture

```
┌────────────────────────────────────────┐
│   React Dashboard  (this repo, src/)   │
│   localhost:5173  (Vite dev server)    │
└────────────────────────────────────────┘
           ↓ REST (Vite proxy / CORS)
┌────────────────────────────────────────┐
│   Spring Boot Backend                  │
│   localhost:8080/api/v1/...            │
└────────────────────────────────────────┘
           ↓ JSON
┌────────────────────────────────────────┐
│   Android IFE Consumer                 │
│   (applib/src/.../ops/)                │
└────────────────────────────────────────┘
           ↓ Bridges
   Seatback managers
```

## Running locally

### Backend

```bash
cd webtools/ops-console/server
./mvnw spring-boot:run
# or:
mvn spring-boot:run
```

### Frontend

```bash
cd webtools/ops-console-ui
npm install
npm run dev
```

Open <http://localhost:5173>.

## REST endpoints

| Method | Path                                  | Notes                          |
|--------|---------------------------------------|--------------------------------|
| GET    | `/api/v1/config/bundle`               | Primary endpoint polled by IFE |
| POST   | `/api/v1/config/features`             | Toggle a feature flag          |
| GET    | `/api/v1/config/features`             | List feature flags             |
| POST   | `/api/v1/config/withdrawals`          | Hide a media item              |
| GET    | `/api/v1/config/withdrawals`          | List withdrawals               |
| POST   | `/api/v1/config/settings`             | Push a runtime setting         |
| GET    | `/api/v1/config/settings`             | List settings                  |
| POST   | `/api/v1/config/themes`               | Upsert theme                   |
| GET    | `/api/v1/config/themes`               | List themes                    |
| POST   | `/api/v1/notifications`               | Send a push notification       |
| GET    | `/api/v1/notifications`               | List notifications             |
| DELETE | `/api/v1/notifications/{id}`          | Remove notification            |
| GET    | `/api/v1/webview/experiences`         | List webview experiences       |
| PUT    | `/api/v1/webview/experiences/{id}`    | Upsert one experience          |
| DELETE | `/api/v1/webview/experiences/{id}`    | Remove experience              |

## Android consumer

The seatback polls `/api/v1/config/bundle` every 5 seconds by default.
Override via:

```gradle
// applib/build.gradle
buildConfigField('String', 'OPS_CONSOLE_BASE_URL', '"http://10.0.2.2:8080"')
buildConfigField('long', 'OPS_CONSOLE_POLL_INTERVAL_MS', '5000')
buildConfigField('boolean', 'OPS_CONSOLE_ENABLED', 'true')
```

Or via Gradle properties:

```bash
./gradlew :applib:assembleDebug -Pops.console.base.url=http://myhost:8080
./gradlew :applib:assembleDebug -Pops.console.poll.interval.ms=2000
./gradlew :applib:assembleDebug -Pops.console.enabled=false
```

## Bridges wired in `SeatbackSetup.install`

| Bridge                 | What it does                                            |
|------------------------|---------------------------------------------------------|
| `ThemeBridge`          | Applies the latest theme's `background` color token     |
| `NotificationBridge`   | Surfaces new notifications via `GenericPopupFragment`   |
| `FeatureFlagBridge`    | Persists flag overrides to SharedPreferences + bus      |
| `WebviewMenuItemBridge`| Publishes pinned webviews for the side drawer + menu    |
| `MediaWithdrawalBridge`| Diff against last-seen set, publish add/remove events   |
| `AppSettingsBridge`    | Surfaces any setting changes via the bus                |
| `SearchAnalyticsIngestBridge` | POSTs search events to `/api/v1/search/events`    |

## Pinned webviews

`pinnedToFooter=true` webviews appear as entries in the side drawer
alongside the built-in categories (Movies, TV Shows, etc.). Tapping one
opens the experience through the registered `WebViewOpener`.

If a previously-pinned webview still appears after you untick the box
and restart the dashboard, the seatback may be replaying the cached
bundle from disk. The cache is automatically discarded when it's
older than one hour (`OperationsServiceImpl.CACHE_MAX_AGE_MS`), so
restarting the seatback after that window will pick up the live state.
To force-flush, clear the seatback app's `cache/operations_bundle_cache.json`
or reinstall the seatback APK.

## Development workflow

The Spring Boot backend has Spring DevTools on the classpath, so
saving a Java source file while `mvn spring-boot:run` is running
triggers a hot restart — no need to manually stop and re-run. Restart
manually only if you change `pom.xml`, `application.properties`, or
add new dependencies.

For fine-grained restart during development:

```bash
./webtools/scripts/restart-backend.sh    # picks up new @RestController routes
./webtools/scripts/restart-frontend.sh   # resets Vite HMR state
```

## Search analytics

The seatback `SearchAnalyticsBridge` consolidates search events:

- `SearchFragment.afterTextChanged` → `SearchAnalyticsBridge.onFirstKeyPress` / `onSearchQuerySubmitted`
- `SearchFragment.onLoadFinished`   → `SearchAnalyticsBridge.onNoResults` / `onResultsReturned`
- The HMS state for `SEARCH` is set to `DEGRADED` when no results and `HEALTHY` when results return.

The dashboard renders a per-subtype breakdown under the **Search Dashboard** tab.
