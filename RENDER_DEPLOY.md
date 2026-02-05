## Render Backend Deployment (Web Service)

This guide deploys the backend service to Render and connects Postgres + Redis.

### 1. Create the Render Web Service
1. Go to Render → **New** → **Web Service**.
2. Connect GitHub and select the repo: `CLOUD-PROJECT-1`.
3. Configure:
   - **Name**: `codecontest-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Health Check Path**: `/health`
   - **Region**: choose nearest to you
4. Click **Create Web Service**.

### 2. Create Postgres in Render
1. Render → **New** → **PostgreSQL**.
2. Name it (e.g. `codecontest-db`) and create it.
3. Copy the **Internal Database URL**.

### 3. Create Redis in Render
1. Render → **New** → **Redis**.
2. Name it (e.g. `codecontest-redis`) and create it.
3. Copy the **Internal Redis URL**.

### 4. Add Environment Variables
Open your backend service → **Environment** tab → add:
- `DATABASE_URL` = *Postgres internal URL*
- `REDIS_URL` = *Redis internal URL*
- `JWT_SECRET` = *a strong random secret*
- `JWT_EXPIRES_IN` = `900`
- `NODE_ENV` = `production`
- `LOG_LEVEL` = `info`
- `FRONTEND_URL` = your Vercel frontend URL (e.g. `https://your-app.vercel.app`)
- `CORS_ORIGIN` = same as `FRONTEND_URL`

### 5. Deploy
Render will auto-deploy after env vars are saved. Wait for **Live** status.

### 6. Verify Backend
Open:
`https://<your-backend>.onrender.com/health`
You should see `{ "status": "healthy" }`.

### 7. Update Vercel Rewrites
Replace the placeholder in `vercel.json` with your backend URL:
`https://<your-backend>.onrender.com`
