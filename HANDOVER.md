# Societrack — Developer Handover

Last updated: June 2026  
Read this first when taking over the project.

---

## 1. What is Societrack?

Society/apartment management SaaS: maintenance, expenses, income, residents, reports, subscriptions (Razorpay), super-admin panel.

| Layer | Tech |
|-------|------|
| Frontend (web + Android shell) | React 18, Vite, Tailwind, Capacitor 8 |
| Backend API | Python FastAPI on Azure App Service |
| Database / Auth / Storage | Supabase (PostgreSQL) |
| Payments | Razorpay |
| Web hosting | Azure Static Web Apps |
| Android | Capacitor → Google Play (Internal / Closed testing) |

---

## 2. Repository & Git

| Item | Value |
|------|-------|
| **GitHub repo** | https://github.com/societrack-Flat/societrack.git |
| **Default branch** | `main` |

### Clone & run locally

```powershell
git clone https://github.com/societrack-Flat/societrack.git
cd societrack
```

### Push workflow

1. Make changes on a branch or directly on `main` (team preference).
2. Commit with a clear message.
3. `git push origin main`
4. GitHub Actions auto-deploys **frontend** and **backend** (see §7).

**Never commit:** `.env`, keystore files, API secrets, passwords.

---

## 3. Project structure

```
societrack/
├── frontend/          # React app + Capacitor Android project
│   ├── android/       # Native Android (open in Android Studio)
│   ├── src/           # App source
│   ├── supabase/      # SQL migrations
│   └── .env           # Local secrets (NOT in git)
├── backend/           # FastAPI API
│   └── .env           # Local secrets (NOT in git)
├── .github/workflows/ # CI/CD
└── HANDOVER.md        # This file
```

---

## 4. Live URLs

| Service | URL |
|---------|-----|
| **Website (production)** | https://www.societrack.com |
| **Website (apex — may need DNS fix)** | https://societrack.com → should forward to www |
| **Azure Static Web App (default)** | https://delightful-sea-04d5f7c10.7.azurestaticapps.net |
| **Backend API** | https://societrack-api-ffa2axbagaffghe9.centralindia-01.azurewebsites.net |
| **API health check** | `{API_URL}/health` → should return `{"ok": true}` |
| **Privacy policy** | https://www.societrack.com/privacy |
| **Super admin login** | https://www.societrack.com/superadmin |

---

## 5. Accounts & access (checklist)

Fill in **`CREDENTIALS.local.md`** (copy from `CREDENTIALS.template.md`) and store in a password manager. **Do not commit filled credentials to git.**

| System | Purpose | Where to get access |
|--------|---------|---------------------|
| **GitHub** | Code, Actions secrets | github.com/societrack-Flat |
| **Azure Portal** | Frontend SWA + backend API | portal.azure.com |
| **Supabase** | DB, auth, storage | supabase.com dashboard |
| **GoDaddy** | Domain societrack.com DNS | godaddy.com |
| **Google Play Console** | Android app | play.google.com/console |
| **Razorpay** | Subscriptions / payments | dashboard.razorpay.com |
| **Google account (Play)** | Developer account (paid $25 once) | Gmail used at signup |

---

## 6. Environment variables

### Frontend — `frontend/.env`

Copy from `frontend/.env.example`. Key vars:

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | https://wikcsdrxihewnlxtxlna.supabase.co |
| `VITE_SUPABASE_ANON_KEY` | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpa2NzZHJ4aWhld25seHR4bG5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4ODUzOTksImV4cCI6MjA5MDQ2MTM5OX0.MC1d0xaz-7SPfWDjwWmWmBMzhj2S5x9TwtycjY439bM |
| `VITE_APP_URL` | Production: `https://www.societrack.com` |
| `VITE_API_BASE_URL` | https://societrack-api-ffa2axbagaffghe9.centralindia-01.azurewebsites.net |
| `VITE_SUPPORT_EMAIL` | support@societrack.com |
| `VITE_SUPPORT_PHONE` | +91 8142112121 |

**Important:** `VITE_*` vars are baked in at **build time**. After changing them in Azure/GitHub, redeploy frontend.

### Backend — `backend/.env`

Copy from `backend/.env.example`. Key vars:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Same Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** — server only, never in frontend |
| `CORS_ORIGINS` | Must include web URL + `https://localhost` for Android |
| `APP_PUBLIC_URL` | `https://www.societrack.com` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Payment keys |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook verification |

Azure App Service → **societrack-api** → Configuration → Application settings (same keys as backend `.env`).

### GitHub Actions secrets

Repo → Settings → Secrets and variables → Actions:

| Secret | Used by |
|--------|---------|
| `AZURE_STATIC_WEB_APPS_API_TOKEN_DELIGHTFUL_SEA_04D5F7C10` | Frontend deploy |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`, `VITE_API_BASE_URL`, etc. | Frontend build |
| `AZURE_WEBAPP_PUBLISH_PROFILE` | Backend deploy |

---

## 7. Deployment (CI/CD)

### Frontend (auto on push to `main`)

- Workflow: `.github/workflows/azure-static-web-apps-delightful-sea-04d5f7c10.yml`
- Builds `frontend/` → deploys to Azure Static Web App **delightful-sea-04d5f7c10**

### Backend (auto on push to `main`)

- Workflow: `.github/workflows/main_societrack-api.yml`
- Deploys `backend/` to Azure App Service **societrack-api** (region: Central India)

### Manual deploy check

1. GitHub → Actions → confirm latest runs are green.
2. Open https://www.societrack.com and test login.
3. Open `{API_URL}/health`.

---

## 8. Supabase

- **Migrations:** `frontend/supabase/migrations/` — run in Supabase SQL editor or CLI when adding new migrations.
- **Auth redirect URLs** (Authentication → URL configuration):
  - Site URL: `https://www.societrack.com`
  - Redirect URLs: `https://www.societrack.com/**`, `https://www.societrack.com/reset-password`, Azure URL if still used
- **Super admin:** email `superadmin@societrack.com` — user must exist in Supabase Auth with `role = super_admin` in `users` table.
- **Setup script:** `frontend/src/lib/setupSuperadmin.js` (run once in dev if needed).

---

## 9. Domain & DNS (GoDaddy)

| Record | Name | Value |
|--------|------|-------|
| **CNAME** | `www` | `delightful-sea-04d5f7c10.7.azurestaticapps.net` |

**Known issue:** `societrack.com` (without www) may show GoDaddy parking page.

**Fix (easiest):** GoDaddy → Domain forwarding → `societrack.com` → `https://www.societrack.com` (301 permanent).

**Alternative:** Azure Static Web App → Custom domains → add apex `societrack.com` → use A/ALIAS records Azure provides.

---

## 10. Android app

| Item | Value |
|------|-------|
| **Package name** | `com.societrack.app` |
| **App name** | Societrack |
| **Capacitor config** | `frontend/capacitor.config.json` |
| **Keystore file** | `societrack-release.keystore` (repo root — **keep backup offline**) |
| **Key alias** | `societrack` |
| **Release AAB output** | `frontend/android/app/release/app-release.aab` |

### Build release AAB

```powershell
cd frontend
npm install
npm run cap:sync
```

Then in **Android Studio** → Open `frontend/android` →  
**Build → Generate Signed App Bundle / APK** → **Android App Bundle** → **release** → use existing keystore.

**Never upload `app-debug.aab` to Play Store** — only `app-release.aab`.

### Play Console status (as of June 2026)

| Item | Status |
|------|--------|
| Developer account | Active (paid $25 one-time) |
| App created | Societrack |
| Store listing | Done |
| Policy declarations | Done |
| Internal testing | Published |
| Android developer verification | Registered |
| **Production (public)** | **Not live yet** — requires Closed testing (12 testers, 14 days) then Apply for production |

### Play Console links

- Console: https://play.google.com/console
- Internal test link (example): check Play Console → Testing → Internal testing → copy link

---

## 11. Razorpay

- Admin subscription payments go through backend `/api/payments/...`
- Webhook URL: `https://societrack-api-ffa2axbagaffghe9.centralindia-01.azurewebsites.net/api/payments/razorpay/webhook`
- Configure webhook in Razorpay dashboard for `payment.captured`
- Never put `RAZORPAY_KEY_SECRET` in frontend env vars

---

## 12. Local development

### Frontend

```powershell
cd frontend
npm install
copy .env.example .env   # fill values
npm run dev              # http://localhost:5173
```

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # fill values
uvicorn app.main:app --reload --port 8000
```

### Android (test on device)

```powershell
cd frontend
npm run cap:sync
npm run cap:android      # opens Android Studio
```

Debug APK: Build → Build APK(s) in Android Studio (for direct install only).

---

## 13. Key code locations

| Feature | Files |
|---------|-------|
| API client | `frontend/src/lib/apiClient.js`, `apiBaseUrl.js` |
| Auth | `frontend/src/context/AuthContext.jsx` |
| Super admin | `frontend/src/pages/superadmin/`, `backend/app/api/super_admin.py` |
| Maintenance rollover | `frontend/src/lib/maintenanceAutoRollover.js`, `backend/app/api/maintenance_rollover.py` |
| Android downloads | `frontend/src/lib/nativeFile.js`, `downloadFile.js` |
| Attachments | `frontend/src/lib/openAttachment.js` |
| Payments | `backend/app/api/razorpay_payments.py` |
| CI workflows | `.github/workflows/` |

---

## 14. Common tasks for new developer

### Deploy a bug fix

1. Fix code locally, test.
2. Commit + push to `main`.
3. Wait for GitHub Actions (frontend + backend).
4. Verify live site + API health.

### Deploy Android update

1. Bump `versionCode` and `versionName` in `frontend/android/app/build.gradle`.
2. Ensure `frontend/.env` has correct `VITE_API_BASE_URL`.
3. `npm run cap:sync`
4. Build signed **release AAB** with **same keystore**.
5. Upload to Play Console (Closed testing or Production track).

### Add Supabase migration

1. Add SQL file under `frontend/supabase/migrations/`.
2. Run in Supabase dashboard → SQL editor.
3. Deploy any code that uses new columns.

### Reset admin password

Supabase → Authentication → Users → select user → send password reset, or reset manually.

---

## 15. Play Store — path to go live

1. Finish Dashboard checklist (11/11) in Play Console.
2. **Closed testing:** upload AAB, add **12 testers**, they must opt in via test link.
3. Wait **14 days**.
4. Dashboard → **Apply for production**.
5. After approval → **Production** → Create release → upload AAB → Start rollout.
6. Google review (1–7 days) → app live on Play Store.

---

## 16. Security reminders

- Rotate keys if they were ever pasted in chat or committed by mistake.
- `SUPABASE_SERVICE_ROLE_KEY` and `RAZORPAY_KEY_SECRET` are **server-only**.
- Back up `societrack-release.keystore` + password — **losing it means you cannot update the Android app**.
- Play Console sign-in credentials for Google review are in Play Console → App content → Sign-in details.
- Do not commit `societrack-release.keystore` or filled `CREDENTIALS.local.md`.

---

## 17. Credentials file

Copy `CREDENTIALS.template.md` → `CREDENTIALS.local.md` and fill in with the previous owner.  
Store `CREDENTIALS.local.md` in a password manager or encrypted drive only.

---

## 18. Support contacts (product)

| | |
|-|-|
| Support email | support@societrack.com |
| Support phone (in app) | +91 8142112121 |

---

## 19. Handover questions for previous owner

Ask the outgoing developer for:

1. GitHub org access (societrack-Flat)
2. Azure subscription access (Static Web App + societrack-api)
3. Supabase project invite (owner or admin)
4. GoDaddy / domain DNS login
5. Google Play Console admin access (same Gmail as developer account)
6. Razorpay dashboard login
7. Keystore file + keystore password + alias password
8. Play Console test admin account (email/password for Google reviewers)
9. Filled `CREDENTIALS.local.md` or password manager export

---

*End of handover document.*
