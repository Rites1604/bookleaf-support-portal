# Deploying (Vercel + Neon)

About 15 minutes. Needs: a GitHub account, a Vercel account and a Neon account (both have free tiers and can sign in with GitHub), and an Anthropic API key from console.anthropic.com.

## 1. Push the code to GitHub

Create an **empty** repository on GitHub (no README), then from this folder:

```bash
git remote add origin https://github.com/<your-username>/bookleaf-support-portal.git
git push -u origin main
```

Set the repository visibility to whatever BookLeaf confirms (the HR email says public; the assignment PDF says private with their reviewer added as a collaborator).

## 2. Create the database on Neon

1. Go to console.neon.tech → **New Project** → name it `bookleaf`, region **AWS Asia Pacific (Singapore)** or the one closest to you.
2. On the project dashboard, click **Connect**. Copy two connection strings:
   - **Pooled** connection (host contains `-pooler`) → this is `DATABASE_URL`
   - Turn off "Connection pooling" and copy again → this is `DIRECT_URL`

## 3. Load the schema and demo data (from your machine, once)

Shortcut: copy either Neon connection string, then run `npm run db:save-neon`. It writes both URLs into `.env` (keeping the old file as `.env.backup`), after which `npx prisma migrate deploy && npm run db:seed` is all you need. Or pass the URLs inline:

```bash
DATABASE_URL="<pooled url>" DIRECT_URL="<direct url>" npx prisma migrate deploy
```

```bash
DATABASE_URL="<pooled url>" DIRECT_URL="<direct url>" SEED_PASSWORD="BookLeaf@2026" npm run db:seed
```

You should see `Seeded 10 authors, 18 books, 2 admins, 7 tickets.`

## 4. Deploy on Vercel

1. vercel.com → **Add New… → Project** → import the GitHub repository.
2. Framework preset: **Next.js** (detected automatically). Leave build settings as they are; the repo's `vercel-build` script runs migrations and the build.
3. Under **Environment Variables**, add:

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon pooled URL |
| `DIRECT_URL` | Neon direct URL |
| `JWT_SECRET` | output of `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | your Anthropic key |
| `AI_CLASSIFY_MODEL` | `claude-haiku-5-5` |
| `AI_DRAFT_MODEL` | `claude-sonnet-5-5` |

4. Click **Deploy**. When it finishes, Vercel shows the live URL (e.g. `https://bookleaf-support-portal.vercel.app`).

## 5. Check it works

1. Open the URL → log in as `admin@bookleaf.in` / `BookLeaf@2026`. The queue should list 7 tickets.
2. Open a ticket. An AI draft should appear in the reply box within a few seconds. (If it says "AI drafting is switched off", the `ANTHROPIC_API_KEY` variable is missing; add it and redeploy.)
3. Seeded tickets are labelled by keyword rules and marked "review". Click **Re-run AI classification** on each to get AI labels.
4. In a private window, log in as `priya.sharma@email.com`, raise a ticket, and watch it appear in the admin queue without refreshing.
5. `/api-docs` should show the API documentation.

Then put the live URL at the top of `README.md`, commit and push.

## Troubleshooting

- **Build fails on `prisma migrate deploy`:** `DIRECT_URL` is missing or is the pooled URL.
- **Login says "Something went wrong":** `JWT_SECRET` is missing or shorter than 32 characters.
- **Live updates show "Connecting":** expected for a second after each page load; streams reconnect every ~50 s by design.
