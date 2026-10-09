param(
    [switch]$Offline,   # Force SQLite/offline mode regardless of connectivity
    [switch]$EnableRoi, # Kept for backwards-compatible startup commands
    [switch]$DisableRoi # Use full-frame preprocessing for controlled fallback tests
)

$root    = $PSScriptRoot
$bio     = Join-Path $root "biometric-engine"
$envFile = Join-Path $root "backend\.env"
# ROI is the normal mode because the biometric galleries are generated with
# the same preprocessing. Disable it only for an apples-to-apples fallback test.
$roiValue = if ($DisableRoi) { '0' } else { '1' }
$env:ROI_ENABLED = $roiValue

$pyCandidates = @(
    (Join-Path $bio ".venv312\Scripts\python.exe"),
    (Join-Path $bio ".venv\Scripts\python.exe"),
    (Join-Path $bio "venv\Scripts\python.exe"),
    (Join-Path $bio "cat-facial-recog\venv\Scripts\python.exe")
)
$py = $pyCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $py) {
    $systemPython = Get-Command python -ErrorAction SilentlyContinue
    if ($systemPython) { $py = $systemPython.Source }
}


Write-Host ""
Write-Host "=== PawsitiveCare Startup ===" -ForegroundColor Cyan
if (-not $py) {
    Write-Host "[ERROR] No Python found for biometric services." -ForegroundColor Red
    Write-Host "Create one with: cd biometric-engine; py -3.12 -m venv .venv312; .\.venv312\Scripts\pip install -r requirements.txt" -ForegroundColor Yellow
    exit 1
}
Write-Host "Using biometric Python: $py" -ForegroundColor DarkCyan
Write-Host ""

# --- Helper: patch a single KEY=VALUE line in .env --------------------------
function Set-EnvValue {
    param([string]$Path, [string]$Key, [string]$Value)
    $lines = Get-Content $Path
    $found = $false
    $lines = $lines | ForEach-Object {
        if ($_ -match "^$Key=") { "$Key=$Value"; $found = $true }
        else { $_ }
    }
    if (-not $found) { $lines += "$Key=$Value" }
    # Write UTF-8 WITHOUT BOM -- PHP dotenv silently breaks with a BOM prefix
    [System.IO.File]::WriteAllLines($Path, $lines, [System.Text.UTF8Encoding]::new($false))
}

# --- Helper: free a port ----------------------------------------------------
function Stop-PortProcess {
    param([int]$Port)
    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($listeners) {
        $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($procId in $pids) {
            try {
                Stop-Process -Id $procId -Force -ErrorAction Stop
                Write-Host "  Stopped process on :$Port (PID $procId)" -ForegroundColor Yellow
            } catch {
                Write-Host "  Could not stop PID $procId on :$Port" -ForegroundColor Red
            }
        }
    }
}

# --- Step 1: Free ports -----------------------------------------------------
Write-Host "Freeing ports 8000, 8001, 8002, 5173..." -ForegroundColor DarkCyan
Stop-PortProcess -Port 8000
Stop-PortProcess -Port 8001
Stop-PortProcess -Port 8002
Stop-PortProcess -Port 5173

# --- Step 2: Build biometric databases if missing ---------------------------
$dogDb = "$bio\dog-noseprint\src\Database\dog.db"
$catDb = "$bio\cat-facial-recog\src\Database\cat.db"

if (-not (Test-Path $dogDb)) {
    Write-Host "[1/2] Building dog noseprint database..." -ForegroundColor Yellow
    Push-Location "$bio\dog-noseprint\src"
    & $py create_database.py
    $dogBuildOk = $LASTEXITCODE -eq 0
    Pop-Location
    if (-not $dogBuildOk) { Write-Host "[ERROR] Dog database build failed." -ForegroundColor Red; exit 1 }
} else {
    Write-Host "[1/2] Dog database already exists, skipping." -ForegroundColor Green
}

if (-not (Test-Path $catDb)) {
    Write-Host "[2/2] Building cat facial database..." -ForegroundColor Yellow
    Push-Location "$bio\cat-facial-recog\src"
    & $py create_database.py
    $catBuildOk = $LASTEXITCODE -eq 0
    Pop-Location
    if (-not $catBuildOk) { Write-Host "[ERROR] Cat database build failed." -ForegroundColor Red; exit 1 }
} else {
    Write-Host "[2/2] Cat database already exists, skipping." -ForegroundColor Green
}

# --- Step 3: Check Supabase connectivity ------------------------------------
Write-Host ""

$online = $false

if ($Offline) {
    Write-Host "Offline mode requested -- skipping Supabase check." -ForegroundColor DarkCyan
} else {
    Write-Host "Checking Supabase connection..." -ForegroundColor DarkCyan

    $supabaseHost = "<supabase-project-ref>.pooler.supabase.com"
    $supabasePort = 6543

    $tcp = New-Object System.Net.Sockets.TcpClient
    try {
        $ar = $tcp.BeginConnect($supabaseHost, $supabasePort, $null, $null)
        if ($ar.AsyncWaitHandle.WaitOne(4000)) {
            $tcp.EndConnect($ar)
            $online = $true
        }
    } catch {}
    finally { $tcp.Close() }
}

# --- Step 4: Set DB mode and sync SQLite when online ------------------------
if ($online) {
    Write-Host "  [ONLINE] Supabase reachable -- using PostgreSQL." -ForegroundColor Green
    Set-EnvValue -Path $envFile -Key "DB_CONNECTION" -Value "pgsql"

    Write-Host ""
    Write-Host "Syncing Supabase data to SQLite offline snapshot..." -ForegroundColor DarkCyan
    Write-Host "  breeds, appointments, pets, inventory, and all tables" -ForegroundColor Gray
    Write-Host ""

    Push-Location "$root\backend"
    php artisan config:clear | Out-Null   # flush stale cache so export reads live .env
    php artisan db:export-sqlite --force
    $exportOk = $LASTEXITCODE -eq 0
    Pop-Location

    if (-not $exportOk) {
        Write-Host ""
        Write-Host "  [WARN] SQLite sync had errors -- offline snapshot may be incomplete." -ForegroundColor Yellow
        Write-Host "  The app will still start in online (PostgreSQL) mode." -ForegroundColor Yellow
    }
} else {
    Write-Host "  [OFFLINE] Cannot reach Supabase -- switching to SQLite mode." -ForegroundColor Yellow
    Set-EnvValue -Path $envFile -Key "DB_CONNECTION" -Value "sqlite"

    $sqlitePath = "$root\backend\database\database.sqlite"
    if (-not (Test-Path $sqlitePath)) {
        Write-Host ""
        Write-Host "  [ERROR] No offline snapshot found at backend/database/database.sqlite" -ForegroundColor Red
        Write-Host "  Run the app once with internet so the snapshot can be created, then retry." -ForegroundColor Red
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }

    $sqliteKb = [math]::Round((Get-Item $sqlitePath).Length / 1024, 1)
    Write-Host "  Using snapshot: database.sqlite ($sqliteKb KB)" -ForegroundColor Gray
}

# --- Step 5: Cache Laravel config/routes/views for faster local responses ---
Write-Host ""
Write-Host "Caching Laravel config, routes, and views..." -ForegroundColor DarkCyan
Push-Location "$root\backend"
php artisan config:cache  | Out-Null
php artisan route:cache   | Out-Null
php artisan view:cache    | Out-Null
Pop-Location
Write-Host "  Done." -ForegroundColor Green

# --- Step 6: Start all 4 services -------------------------------------------
$dbMode = if ($online) { "ONLINE (PostgreSQL)" } else { "OFFLINE (SQLite)" }
$frontendLocalMode = if ($online) { 'false' } else { 'true' }
Write-Host ""
Write-Host "Starting all services in $dbMode mode..." -ForegroundColor Cyan
Write-Host ""

# Terminal A -- Dog API (port 8000)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
    `$host.UI.RawUI.WindowTitle = 'Dog API :8000 [ROI=$roiValue]';
    `$env:ROI_ENABLED = '$roiValue';
    `$env:BIOMETRIC_DOG_THRESHOLD = '0.50';
    cd '$bio';
    cd 'dog-noseprint\src';
    & '$py' main.py
"

Start-Sleep -Milliseconds 500

# Terminal B -- Cat API (port 8001)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
    `$host.UI.RawUI.WindowTitle = 'Cat API :8001 [ROI=$roiValue]';
    `$env:ROI_ENABLED = '$roiValue';
    `$env:BIOMETRIC_CAT_THRESHOLD = '0.55';
    cd '$bio';
    cd 'cat-facial-recog\src';
    & '$py' main.py
"

Start-Sleep -Milliseconds 500

# Terminal C -- Laravel Backend (port 8002)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
    `$host.UI.RawUI.WindowTitle = 'Backend :8002 [$dbMode]';
    cd '$root\backend';
    php artisan serve --host=127.0.0.1 --port=8002
"

Start-Sleep -Milliseconds 500

# Terminal D -- Vite Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
    `$host.UI.RawUI.WindowTitle = 'Frontend Vite';
    `$env:VITE_LOCAL_MODE = '$frontendLocalMode';
    cd '$root\frontend-v2';
    npm run dev
"

Write-Host "All 4 windows launched! [$dbMode]" -ForegroundColor Green
Write-Host ""
Write-Host "Health checks (open in browser after ~10s):" -ForegroundColor Cyan
Write-Host "  Dog API  -> http://127.0.0.1:8000"
Write-Host "  Cat API  -> http://127.0.0.1:8001"
Write-Host "  Backend  -> http://127.0.0.1:8002/api/health"
Write-Host "  Frontend -> https://localhost:5173"
Write-Host ""
