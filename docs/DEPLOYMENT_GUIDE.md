# SpendWise AI — Production Deployment & Operations Guide

This guide provides technical specifications, operational procedures, and environment recipes for deploying **SpendWise AI** to production environments.

---

## 1. Environment Configuration & Secret Management

Create a secure `.env` file in the `server/` directory based on `server/.env.example`.

### Production Variables Checklist
| Variable | Required | Description & Recommended Production Value |
| :--- | :---: | :--- |
| `NODE_ENV` | **Yes** | Must be set to `production`. |
| `PORT` | **Yes** | HTTP port (e.g., `5000` or assigned by platform like `10000`). |
| `DATABASE_URL` | **Yes** | Connection string for production PostgreSQL (e.g. `postgresql://user:pass@host:5432/spendwise_prod`). |
| `DATABASE_SSL` | Optional | Set to `true` when connecting to managed cloud databases (Render, Supabase, Neon). |
| `JWT_ACCESS_SECRET` | **Yes** | Cryptographically secure random secret of at least 32 characters. |
| `JWT_ACCESS_EXPIRES_IN` | Optional | Access token lifetime (default: `15m`). |
| `COOKIE_SECURE` | **Yes** | **Must be `true` in production.** Ensures refresh tokens are only transmitted over HTTPS. |
| `CORS_ORIGIN` | **Yes** | Exact browser origin of the frontend (e.g. `https://spendwise.example.com`). |
| `TRUST_PROXY` | Optional | Set to `1` or `loopback` if deployed behind a reverse proxy/CDN. |
| `BCRYPT_COST` | Optional | Cost factor for password hashing (default: `12`). |
| `REMINDER_INTERVAL_MINUTES` | Optional | Cadence for background reminder scans (default: `60`). |
| `REMINDER_BATCH_SIZE` | Optional | Max subscriptions scanned per batch (default: `500`). |

> [!CAUTION]
> Never set `ALLOW_DEMO_SEED=true` or reuse development passwords in production. Keep the test database connection string strictly separate from production data.

---

## 2. Database Initialization & Migration

SpendWise AI uses a version-controlled migration runner in `server/src/db/migrationRunner.js`.

### Running Migrations
To execute pending migrations against the target database:
```bash
npm run db:migrate --workspace server
```
This applies migrations `001` through `005` in strict sequential order within a transaction.

### Seeding Initial Catalog
To populate the production database with verified services and standard categories:
```bash
npm run db:seed --workspace server
```
*(Does not seed fictional demo users or subscriptions; only canonical categories and verified services).*

---

## 3. Docker & Docker Compose Deployment

### Multi-Container Setup (`docker-compose.yml`)
SpendWise AI provides a complete multi-container orchestration definition for standalone hosts (e.g. Ubuntu VPS on AWS EC2, DigitalOcean, or Hetzner).

1. Clone repository and configure `.env`:
   ```bash
   git clone https://github.com/Rohanop03/SpendWise-AI.git
   cd SpendWise-AI
   cp server/.env.example .env
   # Edit .env with production credentials
   ```

2. Start all services in the background:
   ```bash
   docker compose up -d --build
   ```

3. Run migrations inside the server container:
   ```bash
   docker compose exec server npm run db:migrate --workspace server
   docker compose exec server npm run db:seed --workspace server
   ```

4. Verify service health:
   ```bash
   docker compose ps
   curl http://localhost:5000/api/v1/health
   ```

---

## 4. Render Cloud Blueprint Deployment

SpendWise AI includes a native `render.yaml` infrastructure-as-code specification.

1. Create a new account on [Render](https://render.com).
2. Connect your GitHub repository.
3. In the Render Dashboard, click **New > Blueprint**.
4. Select your SpendWise AI repository. Render will detect `render.yaml` and provision:
   - **Database:** Managed PostgreSQL instance (`spendwise-db`).
   - **Backend API:** Web Service (`spendwise-api`) running Node 22 with automatic SSL and proxy trust.
   - **Frontend:** Static Site (`spendwise-web`) with SPA rewrites (`/* -> /index.html`).
5. Complete deployment and run initial database migration from the Render SSH console:
   ```bash
   npm run db:migrate --workspace server
   npm run db:seed --workspace server
   ```

---

## 5. Vercel Static Frontend Deployment

To host the React 19 frontend on Vercel while running the backend on Render/Railway/VPS:

1. Push code to GitHub.
2. In Vercel, import the repository.
3. Configure project settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `./`
   - **Build Command:** `npm run build --workspace client`
   - **Output Directory:** `client/dist`
4. Set Environment Variables:
   - `VITE_API_URL`: URL of your backend API (e.g. `https://api.spendwise.example.com/api/v1`).
5. Deploy. Vercel uses `vercel.json` to handle client-side routing rewrites automatically.

---

## 6. Reverse Proxy Configuration (Nginx / Caddy)

### Nginx Configuration Template
When deploying on a standalone Linux host with Nginx and Certbot (Let's Encrypt):

```nginx
server {
    server_name spendwise.example.com;

    # Frontend Static Files
    location / {
        root /var/www/spendwise/client/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/spendwise.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/spendwise.example.com/privkey.pem;
}
```

---

## 7. Background Reminder Worker Process

SpendWise AI decouples heavy reminder generation from synchronous API request handling.

### Running with systemd
Create a systemd unit file at `/etc/systemd/system/spendwise-worker.service`:

```ini
[Unit]
Description=SpendWise AI Reminder Worker Daemon
After=network.target postgresql.service

[Service]
Type=simple
User=node
WorkingDirectory=/var/www/spendwise
EnvironmentFile=/var/www/spendwise/server/.env
ExecStart=/usr/bin/node server/scripts/startReminderWorker.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the worker:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now spendwise-worker
sudo systemctl status spendwise-worker
```

---

## 8. Backup, Rollback & Disaster Recovery

### Automated PostgreSQL Backup
Configure a daily cron job to dump production records in custom format (`-Fc`):
```bash
pg_dump -U spendwise_app -h localhost -Fc spendwise_prod > /backups/spendwise_$(date +%Y%m%d_%H%M%S).dump
```

### Emergency Disaster Recovery Restoration
> [!CAUTION]
> `pg_restore -c` drops existing objects before recreating them and will overwrite live data. **This is strictly an emergency disaster recovery procedure, NEVER a routine deployment operation.** Routine deployments must only apply forward migrations using `npm run db:migrate --workspace server`. Always take a fresh snapshot before executing any database restoration.

```bash
# Emergency disaster recovery only:
pg_restore -U spendwise_app -d spendwise_prod -c /backups/spendwise_YYYYMMDD_HHMMSS.dump
```

### Migration Rollback Plan
If an applied migration needs reversion:
1. Every migration SQL script in `server/db/migrations/` includes forward definitions.
2. For catastrophic failure recovery, use schema snapshot rollback or restore the pre-migration database snapshot.
3. Because migrations 001–005 use non-destructive column additions and append-only audit structures, forward migrations are safe for ongoing deployments.

---

## 9. Production Readiness Verification Checklist

- [x] Node.js 22 LTS runtime confirmed (`node -v`).
- [x] PostgreSQL 16+ running with connection pooling.
- [x] All 5 migrations applied and verified (`npm run db:migrate`).
- [x] `COOKIE_SECURE=true` and `Strict-Transport-Security` active for production HTTPS.
- [x] `CORS_ORIGIN` configured to match the production frontend origin.
- [x] `JWT_ACCESS_SECRET` contains >= 32 cryptographically random characters.
- [x] Healthcheck endpoint verified locally (`GET /api/v1/health` returns 200).
- [x] SPA fallback rewrite rules configured for client routing (`_redirects`, `vercel.json`).
- [x] Non-root execution configured in Docker containers (`USER node`).
- [x] Automated CI quality gate configured (`.github/workflows/ci.yml`) and validated with local test commands; ready to run upon push.
- [ ] Production public domain and cloud hosting provisioning (pending user deployment to selected provider).
