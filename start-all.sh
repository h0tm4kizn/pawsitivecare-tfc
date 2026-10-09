#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
BIOMETRIC_ROOT="$PROJECT_ROOT/biometric-engine"
BACKEND_ROOT="$PROJECT_ROOT/backend"
FRONTEND_ROOT="$PROJECT_ROOT/frontend-v2"
BACKEND_ENV="$BACKEND_ROOT/.env"
LOG_DIR="${TMPDIR:-/tmp}/pawsitivecare-startup"
OFFLINE_MODE=0
STARTED_PIDS=()
STARTED_NAMES=()

if [[ "${1:-}" == "--offline" ]]; then
  OFFLINE_MODE=1
elif [[ -n "${1:-}" ]]; then
  echo "Usage: ./start-all.sh [--offline]"
  exit 1
fi

find_python() {
  local candidate
  local candidates=(
    "$BIOMETRIC_ROOT/.venv312/bin/python"
    "$BIOMETRIC_ROOT/.venv/bin/python"
    "$BIOMETRIC_ROOT/venv/bin/python"
    "$BIOMETRIC_ROOT/cat-facial-recog/venv/bin/python"
  )

  for candidate in "${candidates[@]}"; do
    if [[ -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  if command -v python3.12 >/dev/null 2>&1; then
    command -v python3.12
    return 0
  fi

  if command -v python3 >/dev/null 2>&1; then
    command -v python3
    return 0
  fi

  return 1
}

set_env_value() {
  local key="$1"
  local value="$2"

  if grep -q "^${key}=" "$BACKEND_ENV"; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" "$BACKEND_ENV"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$BACKEND_ENV"
  fi
}

free_port() {
  local port="$1"
  local listeners
  listeners="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"

  if [[ -n "$listeners" ]]; then
    echo "Stopping existing process on port $port..."
    kill $listeners 2>/dev/null || true
  fi
}

cleanup() {
  local pid
  echo
  echo "Stopping PawsitiveCare services..."
  for pid in "${STARTED_PIDS[@]}"; do
    [[ -z "$pid" ]] && continue
    stop_process_tree "$pid"
  done
  for port in 8000 8001 8002 5173; do
    free_port "$port"
  done
  wait 2>/dev/null || true
  echo "All services stopped."
}

stop_process_tree() {
  local pid="$1"
  local children child
  children="$(pgrep -P "$pid" 2>/dev/null || true)"
  for child in $children; do
    stop_process_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}

is_job_running() {
  local pid="$1"
  case " $(jobs -pr) " in
    *" $pid "*) return 0 ;;
    *) return 1 ;;
  esac
}

wait_for_http_service() {
  local name="$1"
  local url="$2"
  local log_file="$3"
  local attempt

  for ((attempt = 0; attempt < 12; attempt += 1)); do
    if curl -k --connect-timeout 1 --max-time 2 -fsS "$url" >/dev/null 2>&1; then
      echo "Ready: $name ($url)"
      return 0
    fi
    sleep 1
  done

  echo "[ERROR] $name did not become reachable at $url. Check $log_file"
  return 1
}

handle_signal() {
  local signal="$1"
  if [[ "$signal" == "INT" ]]; then
    exit 130
  fi
  exit 143
}

start_service() {
  local name="$1"
  local working_directory="$2"
  shift 2

  (
    cd "$working_directory"
    exec "$@"
  ) >> "$LOG_DIR/$name.log" 2>&1 &

  local pid=$!
  STARTED_PIDS+=("$pid")
  STARTED_NAMES+=("$name")
  echo "Started $name (PID $pid) — log: $LOG_DIR/$name.log"
}

echo
echo "=== PawsitiveCare Startup (macOS) ==="

PYTHON_BIN="$(find_python || true)"
if [[ -z "$PYTHON_BIN" ]]; then
  echo "[ERROR] Python 3 was not found."
  echo "Install Python 3.12, then create the environment with:"
  echo "  cd biometric-engine"
  echo "  python3.12 -m venv .venv312"
  echo "  .venv312/bin/pip install -r requirements.txt"
  exit 1
fi

if [[ ! -f "$BACKEND_ROOT/artisan" || ! -f "$FRONTEND_ROOT/package.json" ]]; then
  echo "[ERROR] Run this script from the PawsitiveCare project."
  exit 1
fi

mkdir -p "$LOG_DIR"
echo "Using biometric Python: $PYTHON_BIN ($("$PYTHON_BIN" --version 2>&1))"

if ! "$PYTHON_BIN" -c "import fastapi, uvicorn" >/dev/null 2>&1; then
  echo "[ERROR] Biometric Python dependencies are missing."
  echo "Install them with:"
  echo "  \"$PYTHON_BIN\" -m pip install -r \"$BIOMETRIC_ROOT/requirements.txt\""
  exit 1
fi

ONLINE=0

if [[ "$OFFLINE_MODE" -eq 1 ]]; then
  echo "Offline mode requested — skipping Supabase check."
elif nc -z -w 4 "${SUPABASE_POOLER_HOST:-<supabase-project-ref>.pooler.supabase.com}" 6543 >/dev/null 2>&1; then
  echo "Supabase TCP port is reachable — verifying an authenticated database query."
  set_env_value "DB_CONNECTION" "pgsql"
  if (
    cd "$BACKEND_ROOT"
    php artisan config:clear >/dev/null &&
      perl -e 'alarm 10; exec @ARGV' php scripts/check-database.php >/dev/null 2>&1
  ); then
    ONLINE=1
  else
    echo "[WARN] PostgreSQL did not pass the database query check; using the local SQLite snapshot."
    set_env_value "DB_CONNECTION" "sqlite"
  fi
fi

if [[ "$ONLINE" -eq 1 ]]; then
  echo "[ONLINE] Supabase is reachable — using PostgreSQL."
  set_env_value "DB_CONNECTION" "pgsql"
  (
    cd "$BACKEND_ROOT"
    php artisan config:clear >/dev/null
    php artisan db:export-sqlite --force
  ) || echo "[WARN] SQLite snapshot sync failed; online startup will continue."
  DB_MODE="ONLINE (PostgreSQL)"
else
  echo "[OFFLINE] Supabase is unavailable — using SQLite."
  set_env_value "DB_CONNECTION" "sqlite"
  if [[ ! -f "$BACKEND_ROOT/database/database.sqlite" ]]; then
    echo "[ERROR] No offline snapshot exists at backend/database/database.sqlite."
    exit 1
  fi
  DB_MODE="OFFLINE (SQLite)"
fi

echo "Refreshing Laravel caches..."
(
  cd "$BACKEND_ROOT"
  php artisan config:cache >/dev/null
  php artisan route:cache >/dev/null
  php artisan view:cache >/dev/null
)

echo "Freeing ports 8000, 8001, 8002, and 5173..."
for port in 8000 8001 8002 5173; do
  free_port "$port"
done
sleep 1

trap cleanup EXIT
trap 'handle_signal INT' INT
trap 'handle_signal TERM' TERM

echo
echo "Starting services in $DB_MODE mode..."
echo "Starting Dog and Cat APIs in explicit local fallback mode (BIOMETRIC_PRODUCTION=0)."
echo "[WARN] Missing Siamese weights will use untrained ImageNet features; restore trained artifacts for production recognition."
start_service "dog-api" "$BIOMETRIC_ROOT/dog-noseprint/src" env BIOMETRIC_PRODUCTION=0 "$PYTHON_BIN" main.py
start_service "cat-api" "$BIOMETRIC_ROOT/cat-facial-recog/src" env BIOMETRIC_PRODUCTION=0 "$PYTHON_BIN" main.py
start_service "backend" "$BACKEND_ROOT" env PHP_CLI_SERVER_WORKERS=8 \
  php artisan serve --host=127.0.0.1 --port=8002
start_service "frontend" "$FRONTEND_ROOT" env \
  VITE_API_TARGET=http://127.0.0.1:8002 \
  VITE_PET_ID_DOG_TARGET=http://127.0.0.1:8000 \
  VITE_PET_ID_CAT_TARGET=http://127.0.0.1:8001 \
  npm run dev -- --force

wait_for_http_service "Laravel API" "http://127.0.0.1:8002/api/health" "$LOG_DIR/backend.log" || exit 1
wait_for_http_service "Vite frontend" "https://127.0.0.1:5173/" "$LOG_DIR/frontend.log" || exit 1

echo
echo "Services are running:"
echo "  Dog API:  http://127.0.0.1:8000 (local fallback mode)"
echo "  Cat API:  http://127.0.0.1:8001 (local fallback mode)"
echo "  Backend:  http://127.0.0.1:8002"
echo "  Frontend: https://localhost:5173"
echo
echo "Press Ctrl+C to stop all services."
echo "Logs: $LOG_DIR"

health_check_ticks=0
backend_health_failed=0
frontend_health_failed=0
while true; do
  for index in "${!STARTED_PIDS[@]}"; do
    pid="${STARTED_PIDS[$index]}"
    [[ -z "$pid" ]] && continue
    service_name="${STARTED_NAMES[$index]}"
    [[ "$service_name" == "backend" || "$service_name" == "frontend" ]] && continue

    if ! is_job_running "$pid"; then
      set +e
      wait "$pid"
      exit_status=$?
      set -e
      STARTED_PIDS[$index]=""

      echo "[WARN] Optional $service_name exited with status $exit_status. See $LOG_DIR/$service_name.log"
    fi
  done

  health_check_ticks=$((health_check_ticks + 1))
  if (( health_check_ticks >= 10 )); then
    health_check_ticks=0
    if curl --connect-timeout 2 --max-time 3 -fsS http://127.0.0.1:8002/api/health >/dev/null 2>&1; then
      if (( backend_health_failed )); then
        echo "[INFO] Laravel API health check recovered."
        backend_health_failed=0
      fi
    elif (( ! backend_health_failed )); then
      echo "[ERROR] Laravel API health check failed on port 8002. Vite may return 502; see $LOG_DIR/backend.log"
      backend_health_failed=1
    fi

    if curl -k --connect-timeout 2 --max-time 3 -fsS https://127.0.0.1:5173/ >/dev/null 2>&1; then
      if (( frontend_health_failed )); then
        echo "[INFO] Vite frontend health check recovered."
        frontend_health_failed=0
      fi
    elif (( ! frontend_health_failed )); then
      echo "[ERROR] Vite frontend health check failed on port 5173. See $LOG_DIR/frontend.log"
      frontend_health_failed=1
    fi
  fi
  sleep 1
done
