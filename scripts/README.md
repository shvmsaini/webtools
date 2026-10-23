# webtools/scripts — Operator helpers

Helper shell scripts for running and operating the Leanback Ops Console.

## Scripts

| Script | Purpose |
|--------|---------|
| `run-dev.sh` | Start, stop, restart, status for backend + frontend |
| `restart-backend.sh` | Restart only the Spring Boot backend (e.g. after adding a new controller/route) |
| `restart-frontend.sh` | Restart only the Vite dev server |
| `watch.sh` | Auto-restart if either dies; prints live status |
| `health.sh` | Probe backend, dump bundle summary, scan logcat for bridge activity |
| `seed.sh` | POST sample data to the backend (welcome / webview / theme / flags) |
| `bump-build-id.sh` | Bump the Android `versionCode` + `versionName` in `appsm/build.gradle` |

## Quick start

```bash
# Start both services
./webtools/scripts/run-dev.sh

# Live status
./webtools/scripts/run-dev.sh status

# Stop both
./webtools/scripts/run-dev.sh stop

# Restart both
./webtools/scripts/run-dev.sh restart

# Restart only one side (faster iteration)
./webtools/scripts/restart-backend.sh     # after adding a new @RestController
./webtools/scripts/restart-frontend.sh    # when Vite HMR gets stuck

# Or, keep them up no matter what
./webtools/scripts/watch.sh
```

## Endpoints

| Service | URL | Port |
|---------|-----|------|
| Backend | http://localhost:8080 | 8080 |
| Frontend | http://localhost:5173 | 5173 |

The Vite dev server proxies `/api/**` to the backend, so the dashboard
UI can be opened from `http://localhost:5173` without CORS gymnastics.

## Logs

| File | Contents |
|------|----------|
| `/tmp/ops-backend.log` | Spring Boot stdout |
| `/tmp/ops-frontend.log` | Vite dev server stdout |

Tail both: `tail -f /tmp/ops-*.log`

## State files

| File | Contents |
|------|----------|
| `/tmp/ops-backend.pid` | PID of managed backend |
| `/tmp/ops-frontend.pid` | PID of managed frontend |

## Configuration

All scripts honor these environment variables:

| Variable | Default | Effect |
|----------|---------|--------|
| `BACKEND_PORT` | 8080 | Spring Boot port |
| `FRONTEND_PORT` | 5173 | Vite dev server port |
| `BACKEND_LOG` | `/tmp/ops-backend.log` | Backend log path |
| `FRONTEND_LOG` | `/tmp/ops-frontend.log` | Frontend log path |
| `OPS_API` | `http://localhost:8080/api/v1` | API base for `seed.sh` / `health.sh` |
| `OPS_FORCE` | `0` | When `1`, `run-dev.sh start` will kill external processes on the target ports |
| `RESTART_FORCE` | `1` | When `0`, `restart-backend.sh` refuses to kill processes it didn't start |
| `ANDROID_SERIAL` / `ADB_SERIAL` | auto-detected | adb device for `health.sh` |

## Forcing a clean restart

If something else is squatting on the ports and you want `run-dev.sh` to
take over:

```bash
OPS_FORCE=1 ./webtools/scripts/run-dev.sh restart
```

## Common workflows

### Fresh dev environment
```bash
./webtools/scripts/run-dev.sh
./webtools/scripts/seed.sh all
# open http://localhost:5173
```

### Android dev loop
```bash
./webtools/scripts/run-dev.sh          # backend + frontend
# in another terminal:
./gradlew :appsm:installDebug          # install fresh APK
adb shell am start -n aero.panasonic.interactive.seatback/.MenuActivity
./webtools/scripts/health.sh           # verify bridges are firing
```

### Add new sample data
```bash
./webtools/scripts/seed.sh welcome     # send the welcome notification
./webtools/scripts/seed.sh webview     # add a sample webview
./webtools/scripts/seed.sh theme       # install a theme
./webtools/scripts/seed.sh flags       # toggle feature flags
./webtools/scripts/seed.sh             # all of the above
```

### Mark a new build
```bash
./webtools/scripts/bump-build-id.sh     # patch bump (1.0.0 → 1.0.1)
./webtools/scripts/bump-build-id.sh minor
./webtools/scripts/bump-build-id.sh 2.0.0-rc1
```

## Notes

- `run-dev.sh` uses `mvn spring-boot:run` for the backend, which keeps
  Maven in the foreground until shutdown. The script backgrounds it via
  `nohup`, but if the JVM crashes mid-build the parent shell may exit.
- The frontend `npm install` is run only on first invocation.
- `health.sh` expects `adb` on `$PATH`. If you have multiple devices
  attached, set `ANDROID_SERIAL` explicitly.
