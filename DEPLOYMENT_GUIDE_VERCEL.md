# 🚀 CivicFix AI — Vercel Production Deployment Guide

This guide explains how to deploy **CivicFix AI** live on **Vercel** with full PostgreSQL cloud database support, live Google SMTP email dispatch, and edge AI capabilities.

---

## 1. Quick Setup: 3-Step Vercel Deployment

### Step 1: Import Repository in Vercel
1. Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **"Add New..." $\rightarrow$ "Project"**.
3. Select your repository: **`hassamjan607/CivicsfixAi`**.
4. In the Project Setup:
   - **Framework Preset**: `Next.js` (detected automatically)
   - **Root Directory**: Click **Edit** and choose `frontend` *(or leave as root; the included `vercel.json` handles both)*.

---

### Step 2: Get a Free Cloud Database (Neon / Supabase)
Because Vercel serverless functions cannot store local SQLite files, use a free cloud PostgreSQL database:

1. **Option A (Recommended — Neon Serverless Postgres)**:
   - Go to [neon.tech](https://neon.tech) and create a free project named `civicfix`.
   - Copy your connection string: `postgresql://user:password@ep-xyz.neon.tech/civicfix?sslmode=require`.
2. **Option B (Vercel Marketplace)**:
   - In your Vercel project, go to the **Storage** tab $\rightarrow$ **Connect Database** $\rightarrow$ **Neon** or **Vercel Postgres**.
   - It will automatically set your `DATABASE_URL`!

*(Note: The build engine automatically detects PostgreSQL and updates `schema.prisma` from `sqlite` to `postgresql` on the fly).*

---

### Step 3: Configure Environment Variables in Vercel
In your Vercel project settings (**Settings $\rightarrow$ Environment Variables**), add the following:

| Variable | Recommended Value | Notes |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://...` | Your Neon / Supabase cloud connection string |
| `AUTH_SECRET` | `civicfix-jwt-super-secret-key-32-chars-long-2026` | 32+ char secret for session tokens |
| `EMAIL_PROVIDER` | `smtp` | Enables live email dispatch |
| `SMTP_HOST` | `smtp.gmail.com` | Google mail server |
| `SMTP_PORT` | `465` | Secure SSL port |
| `SMTP_SECURE` | `true` | Required for port 465 |
| `SMTP_USER` | `hassamjan607@gmail.com` | Your email address |
| `SMTP_PASS` | `sbfp izrn pzij ripz` | Your 16-letter Google App Password |
| `EMAIL_FROM` | `CivicFix Municipal Alert <hassamjan607@gmail.com>` | Sender display header |
| `NEXT_PUBLIC_DEMO_MODE` | `true` | Enables role switcher & live testing |
| `SIGNED_LINK_SECRET` | `civicfix-hmac-signed-token-secret-2026` | One-click email token validation |

---

## 2. Pushing the Database Schema to Cloud

Once you deploy or connect your cloud database for the first time, run the schema sync to create all municipal tables:

In your local terminal (pointing to the cloud DB in `frontend/.env`):
```bash
cd frontend
npm run db:push
```
Or run the seed script to create initial departments (WASA, TEPA) and officer accounts:
```bash
npm run seed
```

---

## 3. Automated Dual-Database Architecture
CivicFix AI includes an intelligent database switcher (`frontend/scripts/prepare-db.js`):
- **Local Development**: When `DATABASE_URL` is a local file (`file:./dev.db`), it automatically runs in **SQLite** mode.
- **Vercel Cloud**: When `DATABASE_URL` starts with `postgres://` or `postgresql://`, it automatically configures **PostgreSQL** mode and generates the matching Prisma client.

No manual schema editing is ever needed!
