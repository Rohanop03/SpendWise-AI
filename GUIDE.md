# Run each in its own PowerShell window, from the project root (C:\Users\sayak\Desktop\SpendWise AI):


## 1. Start the database (Docker Postgres on port 5434; it auto-restarts once created)
docker start ssm-postgres

## 2. Apply the migrations (instant if already applied); optionally load the demo data
npm run db:migrate --workspace server
npm run db:seed:demo --workspace server

## 3. Backend: http://localhost:5000
npm run dev --workspace server

## 4. Frontend: http://localhost:5173 (Vite forwards /api to the backend, so no CORS setup is needed)
npm run dev --workspace client