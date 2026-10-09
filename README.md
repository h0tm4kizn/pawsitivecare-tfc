# PawsitiveCare: Web-Based Pet Management System Using Dog Nose Print and Cat Face Recognition for The Fur Club Pet Station

## Public Repository Notice

This repository is a sanitized public academic version of PawsitiveCare,
created for project presentation, evaluation, and academic review.

The complete development repository remains private to protect confidential
project information, client-related data, credentials, operational records,
biometric datasets, and other sensitive or non-public assets associated
with The Fur Club Pet Station.

As a result, certain datasets, environment configurations, deployment
credentials, runtime databases, biometric records, internal documentation,
and other sensitive files are intentionally excluded from this repository.

This public repository is intended to demonstrate the system's architecture,
implementation, features, and technical approach without exposing
confidential or operational data.

The pet image datasets used for training and evaluation are not included in
this public repository due to privacy, data-usage, and redistribution
considerations. The repository retains the implementation and evaluation
code necessary to document the biometric identification pipeline.

## Overview

PawsitiveCare is a client-server web application for The Fur Club Pet Station. It centralizes pet, owner, appointment, service, hotel, inventory, payment documentation, staff operations, reporting, and access-control workflows in a responsive React interface.

PawsitiveCare integrates **Species-Adaptive Pet Identification** using nose-print recognition for dogs and facial recognition for cats. YOLOv8 detects and isolates the relevant nose or face region, while a Siamese Neural Network with EfficientNetV2B0 generates feature representations for cosine-similarity-based identity matching. This approach supports enrollment of new pets without treating every pet as a fixed classification label. Identification results support or verify a pet's identity; they are not a guarantee of identity.

## Architecture

PawsitiveCare consists of a React/Vite frontend and a Laravel REST API backend, supplemented by separate Python FastAPI services for dog nose-print and cat face recognition.

```text
React frontend
  └─ Laravel REST API ── application database
       ├─ Dog FastAPI service (:8000)
       ├─ Cat FastAPI service (:8001)
       └─ PowerSync token/upload endpoints

Dog scanner ── YOLOv8 dog-nose ROI ── EfficientNetV2B0/Siamese ── gallery match
Cat scanner ── YOLOv8 cat-face ROI ── EfficientNetV2B0/Siamese ── gallery match
```

This is not a pure monolith, a full microservices deployment, or a fully offline-first application.

The admin application exposes **Services** as a top-level navigation area. Service
management includes services, packages/tiers, add-ons, and promotions; it is not
duplicated under Settings.

## Key Features

### Species-Adaptive Pet Identification

- **Dogs:** Nose-Print Recognition
- **Cats:** Facial Recognition

YOLOv8 detects and localizes the relevant dog-nose or cat-face region. The resulting region is processed by the EfficientNetV2B0/Siamese model to generate feature representations, which are compared using similarity-based matching. The module supports enrollment of new pets without requiring each pet to become a fixed classification label.

### Pet and Service Records

The system centralizes pet profiles, pet owner information, service histories, pet assessment records, grooming records, hotel records, daycare records, and pet identification enrollment information.

### Appointment Scheduling

Pet owners can submit appointment requests for grooming, hotel, and daycare services. Authorized staff can manage schedules, service selections, appointment statuses, staff assignments, check-in/check-out details, and related service records.

### Walk-In Services

Authorized staff can accommodate customers who arrive without a prior online appointment by using the existing service and appointment workflow. Depending on the service, staff can select the customer and pet, choose a service/package and add-ons, assign staff, apply eligible promotions, document payment information, and complete the service.

### Hotel Management and Occupancy

Hotel workflows support reservations, suite and cluster occupancy, capacity monitoring, check-in/check-out, and live occupancy views for authorized staff.

### Payment Documentation and Tracking

The system records transaction and payment details, payment status, reference numbers, supported payment account information, QR-based payment documentation where applicable, and proof of payment for authorized review or verification. Payment functionality is intended for documentation, tracking, and authorized verification; it does not perform automated payment gateway processing.

### Promo Management

Authorized administrators can create and manage promotions for selected services, packages, and supported inventory items. Promotions can use percentage discounts, fixed discounts, or promotional/set prices with configured validity periods and eligibility rules.

### Staff Attendance

Staff attendance includes Time In, Time Out, attendance history, Currently On Duty status, missing-time-out monitoring, and authorized administrative corrections. The system does not provide automatic time-out.

### Staff Commissions

The system supports configurable commission settings, commission applicability based on staff and handled/completed services, commission records, automatic generation for eligible completed appointments, and commission reporting. This is commission tracking, not payroll processing.

### Inventory Management

Inventory management maintains product and supply records, pricing, availability, and stock-related operations. The system also supports separate **Walk-In Retail Sales** for inventory items, including applicable promotions and sale records. Inventory functionality can be enabled or disabled according to operational needs.

### Role-Based Access Control

Different access levels are provided for:

- Administrator
- Staff
- Pet Owner

### Authentication

Authentication and account verification mechanisms include:

- Laravel Sanctum
- Email OTP
- Google Authenticator/TOTP

### Backup and Recovery

Administrators can create, upload, download, and restore system data backups through the available backup workflows.

### Reports and Data Export

Reporting areas cover appointments, customers and pets, services, sales, staff activity, staff attendance, staff commissions, and hotel-related records. PDF and CSV export are available in the supported reporting views.

### Responsive Web Interface

The system provides responsive interfaces for desktop, tablet, and mobile web use, with mobile-specific views for selected operational workflows.

### Offline Data Synchronization

PowerSync and local SQLite-based storage provide synchronization and limited offline access for supported parts of the application. Previously synchronized supported data may remain available during temporary connectivity interruptions; the entire application is not fully offline.

### Notifications

Users receive relevant system, appointment, and service notifications according to their role and workflow.

### Activity and Audit History

Authorized administrative activity and selected system actions are recorded to support operational traceability.

## Pet Identification

### Current executable pipeline

Both species-specific FastAPI services use the same high-level pipeline:

```text
image upload
  → YOLOv8 ROI detection/localization
  → padded ROI crop (15% padding)
  → 224×224 model input
  → EfficientNetV2B0 Siamese metric-learning backbone
  → 128-D L2-normalized embedding
  → cosine similarity against the species gallery
  → identity result or UNKNOWN
```

YOLOv8 locates the dog nose or cat face; it does not identify the individual pet. Individual matching is performed with the learned embedding and cosine similarity.

| Species | ROI | Service | Runtime port | Endpoints | Runtime default threshold |
| --- | --- | --- | ---: | --- | ---: |
| Dog | Dog nose | `biometric-engine/dog-noseprint/src/main.py` | 8000 | `POST /reg`, `POST /scanning` | 0.50 |
| Cat | Cat face | `biometric-engine/cat-facial-recog/src/main.py` | 8001 | `POST /reg`, `POST /scanning` | 0.55 |

The ROI confidence is currently a runtime constant of `0.25`; it is not an environment variable. Production mode requires a valid ROI. The services store gallery embeddings in species-specific SQLite databases under each service's `src/Database/` directory; generated/runtime database files and image uploads are ignored by Git. Optional YOLO weight overrides are `ROI_DOG_WEIGHTS` and `ROI_CAT_WEIGHTS`. `BIOMETRIC_PRODUCTION` defaults to production mode, and `BIOMETRIC_DOG_THRESHOLD` / `BIOMETRIC_CAT_THRESHOLD` can override the runtime defaults. These defaults are provisional and must not be treated as the release acceptance threshold; the release gate requires a verified similarity score above `0.85`.

## Technology Stack

### Frontend

- React 18.3, Vite 8, React Router 7, Zustand 5
- Tailwind CSS 3.4
- PowerSync Web 1.37 and PowerSync React 1.10
- WA-SQLite 1.7 for browser-local storage
- jsPDF 4.2 and jsPDF AutoTable 5
- ZXing Browser 0.2 for QR/barcode scanning
- React Easy Crop, html2canvas, qrcode.react, and `ph-locations`
- Lucide React for interface icons and Vercel Speed Insights
- Vite React, WASM, top-level-await, and basic-SSL plugins
- ESLint, SWC, esbuild, Rollup, PostCSS, Autoprefixer, Sharp, and Playwright tooling

### Backend

- PHP 8.2+
- Laravel 11
- Laravel Sanctum 4
- DomPDF 3.1
- PHPUnit 10.5
- PostgreSQL driver support through `pdo_pgsql`; local SQLite support is also configured
- Livewire 4, Laravel Tinker, and Flysystem S3 support
- Laravel Sail, Pint, Faker, Mockery, Collision, and Laravel Ignition for development and testing

### Biometric services

- Python dependencies are pinned in `biometric-engine/requirements.txt`: FastAPI 0.109, Uvicorn 0.27, TensorFlow 2.16.1, Keras 2.12, Ultralytics 8.0.147, NumPy 1.26.3, Pillow 10.2, SciPy 1.12, pandas 2.0.2, Supabase 2.3, python-dotenv, Requests, and python-multipart.
- EfficientNetV2B0 is used as the feature-extraction backbone in the Siamese metric-learning pipeline.

### Testing and tooling

Node/npm, Composer, Git, Playwright, PHPUnit, and the repository's QA suites are included. Frontend scripts are under `frontend-v2/package.json`; the root `package.json` runs Playwright; backend dependencies and tests are under `backend/`.

## Project Structure

```text
backend/             Laravel API, migrations, models, services, tests
frontend-v2/         React/Vite application and frontend tests
biometric-engine/    Dog and cat FastAPI services, ML code, galleries, tests
powersync/           PowerSync service, sync, and CLI configuration
qa/                  Playwright QA plans, helpers, data, and tests
documentation/       Deployment and technical documentation
render/              Render Docker/Apache startup configuration
start-all.ps1        Windows local launcher for all four services
start-all.sh         macOS/Linux local launcher for all four services
vercel.json          Vercel frontend build and SPA routing configuration
```

## Prerequisites

- PHP 8.2 or later and Composer
- Node.js 22 and npm
- Python 3.12 is the repository's documented biometric environment target
- PostgreSQL-compatible access for online development/deployment, or the local SQLite snapshot for offline/demo mode
- Git

## Local Development Setup

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan storage:link
php artisan serve --host=127.0.0.1 --port=8002
```

Configure the backend `.env` before starting. The committed example defaults to SQLite for local/offline use and includes commented PostgreSQL/Supabase settings for online use.

### Frontend

```bash
cd frontend-v2
npm install
cp .env.example .env
npm run dev
```

The frontend example uses same-origin proxy paths and points local proxies at the Laravel API and biometric services. The repository launcher supplies the actual local targets on ports 8000 and 8001.

### Biometric services

```bash
cd biometric-engine
py -3.12 -m venv .venv312
.\\.venv312\\Scripts\\pip install -r requirements.txt
```

Start each service in its own terminal:

```bash
cd biometric-engine/dog-noseprint/src
python main.py                 # http://127.0.0.1:8000

cd biometric-engine/cat-facial-recog/src
python main.py                 # http://127.0.0.1:8001
```

On macOS/Linux, use the equivalent `.venv312/bin/python` commands. The service-specific `.env.example` documents CORS, upload limits, Supabase, ROI weight, production-mode, and threshold configuration.

### Start all services

On Windows:

```powershell
.\\start-all.ps1
```

Use `.\\start-all.ps1 -Offline` to force the local SQLite snapshot. The launcher starts the dog API, cat API, Laravel API on port 8002, and Vite frontend. On macOS/Linux:

```bash
./start-all.sh
./start-all.sh --offline
```

When online, the launchers select PostgreSQL and attempt to export a SQLite snapshot. When Supabase is unavailable or offline mode is requested, they select `backend/database/database.sqlite`.

### PowerSync / offline access

PowerSync is integrated for authenticated synchronization and local browser storage for supported tables, including pets, appointments, services, service tiers/add-ons, hotel suites, owners, notifications, breeds, and species types. The connector obtains short-lived credentials from Laravel and uploads queued local changes through the Laravel PowerSync endpoint.

This is limited offline/local access, not whole-application offline operation. Administrative, reporting, attendance, backup, and other workflows still depend on the Laravel API and their available data. PowerSync service and sync definitions are under `powersync/`; deployment status and operational notes are under `documentation/powersync/`.

## Environment Configuration

Only use placeholders in documentation. Relevant variable names include:

- Backend: `APP_KEY`, `APP_URL`, `APP_TIMEZONE`, `DB_CONNECTION`, PostgreSQL `DB_*` values, mail settings, `LOGIN_OTP_ENABLED`, Supabase storage settings, and PowerSync server settings.
- Frontend: `VITE_API_URL`, `VITE_API_TARGET`, `VITE_PET_ID_DOG_URL`, `VITE_PET_ID_CAT_URL`, their target variables, and camera settings.
- Biometric: `SUPABASE_URL`, `SUPABASE_KEY`, `ALLOWED_ORIGINS`, `BIOMETRIC_ALLOWED_ORIGINS`, upload/image limits, `ROI_DOG_WEIGHTS`, `ROI_CAT_WEIGHTS`, `BIOMETRIC_PRODUCTION`, and optional species threshold overrides.

Do not commit credentials, API keys, tokens, private keys, database passwords, biometric data, or private datasets.

## Database

### Local development database

Laravel supports SQLite, and the repository includes `backend/database/database.sqlite` as a local/offline snapshot used by the launcher when offline mode is selected. The biometric services use separate species gallery SQLite files under their service directories when those generated files exist.

### Production/deployment database

The deployment configuration and PowerSync configuration target PostgreSQL supplied by Supabase. The Render Docker image installs `pdo_pgsql`/`pgsql`. Supabase PostgreSQL is therefore the deployment database architecture; the local SQLite snapshot must not be described as the production database.

## Deployment

- **Vercel** builds and serves `frontend-v2/dist` using the root `vercel.json` configuration.
- **Render** builds the Laravel backend from the root `Dockerfile`, using Apache/PHP 8.2 and `render/start.sh`.
- **Supabase PostgreSQL** is the configured online relational database and storage integration point.
- **PowerSync** configuration and sync streams are maintained under `powersync/`; deployment status is documented separately and should be verified against the target environment before release.

No production URLs or credentials are required in this repository README.

## Authentication and Access Control

Laravel Sanctum protects API sessions/tokens. Role middleware and policies distinguish administrator, staff, and customer/pet-owner capabilities. The authentication implementation includes email OTP flows and an optional authenticator/TOTP lifecycle with setup, confirmation, disable, and recovery-code handling.

## Testing

Backend tests:

```bash
cd backend
php artisan test
```

Frontend and QA tests use Playwright:

```bash
cd ..
npm install
npm test
```

Frontend lint/build scripts are available in `frontend-v2/package.json`; biometric tests and pipeline checks are under `biometric-engine/tests/`.

## Project Scope

PawsitiveCare covers pet and owner records, grooming, daycare, hotel, appointments, services and add-ons, promotions, payment documentation, inventory, walk-in retail sales, staff attendance, commissions, notifications, reports, audit records, backup/restore, and species-adaptive pet identification.

## Important Notes

- Use **Species-Adaptive Pet Identification** as the module name.
- We use the terms dog nose-print recognition and cat facial recognition; we do not describe the entire platform as an “AI-powered pet management system.”
- We use YOLOv8 for ROI localization, while the embedding gallery and cosine similarity provide the individual-match step.
- We treat identification as support for or verification of identity, not as a guarantee.
- We use the payment functionality to document, track, and verify payment evidence; it is not an external payment gateway.
- We use PowerSync for synchronization and limited offline/local access across supported parts of the application.
- We intentionally exclude thesis chapters, survey results, UREC material, respondent information, training datasets, and pet biometric data from this README.

## Project Team

- **Renielyn B. Lenon** — Full-Stack Developer & ML Engineer
- **Krissha Rhane R. Monte** — Frontend Developer
- **Lyeanne D. Gadiano** — Frontend Developer
- **Daniecy G. Calica** — Database Administrator & Technical Documentation

Bachelor of Science in Information Technology
Polytechnic University of the Philippines – San Juan Campus
Academic Year 2026–2027
