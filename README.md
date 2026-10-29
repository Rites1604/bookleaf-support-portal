# BookLeaf Author Support & Communication Portal

A web app where BookLeaf authors check their books and royalties and raise support tickets, and the operations team works those tickets with AI-assisted triage and reply drafting.

- **Author portal:** My Books (sales, royalty earned/paid/pending, payout status, production tracker), raise a ticket, ticket threads with live updates.
- **Admin portal:** urgency-sorted queue with filters and SLA flags, AI category + priority with overrides, AI-drafted replies grounded in the Knowledge Base and the author's record, internal notes, assignment, AI usage page.
- **API:** versioned REST under `/api/v1`, cookie session auth, role-based access, Zod validation, uniform errors, OpenAPI spec rendered at `/api-docs`.

## Demo logins

Every seeded account uses the password **`BookLeaf@2026`** (set by `SEED_PASSWORD`).

| Role | Email | Why this one |
|---|---|---|
| Admin | `admin@bookleaf.in` | Support Admin |
| Admin | `ops@bookleaf.in` | Second admin, to see assignment |
| Author | `priya.sharma@email.com` | Two published books, pending royalty, one resolved ticket with history |
| Author | `kavita.deshmukh@email.com` | One book in production (Typesetting), one with ₹850 pending (below payout threshold) |
| Author | `sneha.kulkarni@email.com` | Three books incl. one in Cover Design |
| Author | `ananya.reddy@email.com` | Never paid, payout overdue |

All 10 authors from `bookleaf_sample_data.json` can log in with their dataset email.

## Run locally

Requires Node 20+ and PostgreSQL 14+.

```bash
cp .env.example .env          # then fill DATABASE_URL, DIRECT_URL, JWT_SECRET, ANTHROPIC_API_KEY
npm install                   # also runs prisma generate
npx prisma migrate deploy     # create tables
npm run db:seed               # load the dataset, admins and demo tickets
npm run dev                   # http://localhost:3000
```

`npm test` runs the unit tests (no database or API key needed). `npm run eval:classifier` runs the brief's sample queries through the live classifier and prints accuracy (needs `ANTHROPIC_API_KEY`). Last run: **9/9 categories correct, 9/9 priorities at or above the expected level.**

### Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Postgres. On Neon, pooled and direct URLs; locally the same value. |
| `JWT_SECRET` | 32+ chars, signs the session cookie. |
| `ANTHROPIC_API_KEY` | Server-only. If empty, the app runs entirely on the rule-based fallback. |
| `AI_CLASSIFY_MODEL` / `AI_DRAFT_MODEL` | Default `claude-haiku-5-5` / `claude-sonnet-5-5`. |
| `AI_TIMEOUT_MS` | Per-attempt timeout for AI calls (default 15000). |
| `SEED_PASSWORD` | Password given to every seeded account. |

## Architecture

```
src/
  app/
    author/…, admin/…        pages (client components calling the API)
    api/v1/…                 route handlers: parse → service → respond, nothing else
    api-docs/                Swagger UI over /api/v1/openapi
  server/
    http/route.ts            auth + role guard + error mapping for every protected route
    http/errors.ts           ApiError and the single error shape
    auth/                    JWT session cookie (jose), bcrypt passwords
    services/                ticketService, bookService, authService: all business rules
    ai/
      client.ts              SDK client, timeouts/retries, failure reasons, usage ledger
      knowledgeBase.ts       the KB split by category, plus tone rules
      prompts/               classify.ts, draft.ts (versioned prompts)
      classifier.ts          Haiku structured output → falls back to rules
      fallbackClassifier.ts  keyword rules used when AI is unavailable
      drafter.ts             Sonnet drafts, cached by context hash
  lib/                       shared by client and server: enums, royalty rules, Zod schemas
  middleware.ts              page-level redirects by role
prisma/schema.prisma, seed.ts, data/bookleaf_sample_data.json
tests/                       vitest: AI layer (mocked SDK), royalty rules, fallback rules
```

**Why these choices**

- **Next.js (App Router) for both UI and API.** One deployable, one language, shared types and validation between client and server. Route handlers stay thin; logic lives in `server/services`, so the API could move to a standalone Express/Fastify service without rewriting it.
- **PostgreSQL + Prisma.** The data is relational (author → books → tickets → messages). Enums are declared in severity order, so "most urgent first" is a plain `ORDER BY status, priority, created_at` on an index.
- **Labels remember who set them.** `categorySource` / `prioritySource` are `PENDING | AI | FALLBACK | ADMIN`. An admin override is never overwritten by a later AI run, and tickets labelled by the fallback show a "review" marker in the queue.
- **Authorisation in one place.** `route([roles], handler)` resolves the session and role before any handler runs. Author queries are always scoped by `authorId` from the session, never from the request, so authors get a 404 (not a 403) for other people's tickets. Internal notes and triage metadata are stripped server-side for authors.
- **Real time via SSE.** Updates only flow server → client, so SSE is simpler than WebSockets and works through proxies. The stream polls an indexed `updatedAt` every 2 s rather than using an in-memory emitter, because on serverless hosting the request that writes a ticket and the one holding the stream are usually different instances. Streams end after ~50 s and `EventSource` reconnects with `Last-Event-ID`, so nothing is missed.

## AI integration

### What runs when

| Moment | Model | Input | Output |
|---|---|---|---|
| Author submits a ticket | Haiku | system prompt (category guide + priority rules) + subject, description, book title/status | `{category, priority, confidence, reasoning}` via structured output |
| Admin opens a ticket | Sonnet | system prompt (role, company overview, tone rules, drafting rules) + one KB section + the author's record + last 4 messages | Plain-text reply, signed by the admin |

Classification runs **after** the ticket is saved (Next.js `after()`), so creating a ticket never waits on, or fails because of, the AI provider. The queue receives the labels over SSE a moment later.

### Prompt strategy

- **The KB is split by category** (`knowledgeBase.ts`). A draft carries only its category's policy and its sample query → expected handling from the brief, plus the always-on tone guidelines. A printing complaint never sees the royalty policy.
- **The classifier sees payout status too.** For royalty tickets it gets a one-line summary from the author's record ("₹2,546 pending and OVERDUE", "₹850 below threshold"), so priority reflects whether money is actually late, not just how upset the message sounds.
- **Grounded in real numbers.** The prompt includes the author's record for the relevant category: copies sold, earned/paid/pending in ₹, last payout, the next payout deadline computed from the quarterly + 45-day rule, and explicit flags for "below ₹1,000 threshold, rolls over" and "likely overdue". The tone guide asks for specific numbers and dates, and the model gets them instead of having to make them up.
- **Rules that match the tone guide:** acknowledge first, own BookLeaf's mistakes, give a concrete timeline for escalations, end with a next step, never quote internal notes, never invent figures. Author text is wrapped in tags and treated as data (basic prompt-injection hygiene).
- **The classifier uses structured outputs** (`output_config.format` with a Zod schema), so its response is always valid JSON with a known category/priority. Priority rules are written from BookLeaf's policy (e.g. any ISBN error is at least High; long-unpaid royalties are Critical).
- Prompts are versioned (`classify-v1`, `draft-v1`) and the version is stored with each draft.

### Cost awareness

- **Haiku for classification at low effort.** It's a short, well-specified task on every ticket, so it uses the cheapest model.
- **Sonnet only for drafts**, generated once per ticket state. Drafts are stored with a hash of their exact prompt: reopening a ticket returns the stored draft for free; a new author message or a category change produces a new hash and a new draft. "Regenerate" is explicit.
- **Trimmed context:** one KB section instead of the whole KB, only record fields relevant to the category, the last 4 messages (each capped at 800 chars) instead of the full history.
- **Static system prompts** (no dates, names or ids) with `cache_control`, so they're served from the prompt cache on repeat calls. In the local test run, about 90% of the classifier's input tokens were cache reads.
- **Measured cost** (local run, list prices): classification ≈ $0.00007 per ticket, a draft ≈ $0.005. Reopening a ticket returns the stored draft in ~10 ms at no cost.
- **Every call is logged** to `AiUsage` (tokens in/out/cached, latency, success, error code). `/admin/ai-usage` shows spend by task and how often admins edited the draft before sending, which is a useful signal for draft quality.

### When the AI is down

| Failure | What happens |
|---|---|
| No API key | AI is skipped entirely; tickets are labelled by keyword rules (marked "review"); the composer says drafting is off. |
| 429 / 5xx / network | The SDK retries twice with backoff, with a timeout on each attempt. Then classification falls back to rules and the draft panel says why and offers Regenerate. |
| Refusal / unusable output | Treated the same as an outage. A draft cut off at `max_tokens` is discarded instead of being shown half-written. |

Tickets are always created and admins can always reply manually. Fallback-labelled tickets have a "Re-run AI classification" action once the provider is back.

### Why Claude

Claude Haiku is inexpensive and reliable at constrained classification with structured outputs; Claude Sonnet writes warm, specific support replies that follow detailed tone rules closely. Using one provider means one SDK, one error model and one place to configure keys. Both models are set by env var, so swapping models is a config change.

## API

Full spec: **`/api-docs`** (Swagger UI) or **`/api/v1/openapi`** (JSON). Summary:

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/auth/login` | public | Email + password → session cookie |
| POST | `/auth/logout` | public | Clear session |
| GET | `/auth/me` | any | Current user (+ `aiEnabled` for admins) |
| GET | `/books` | any | Author: own books. Admin: all, or `?authorId=` |
| GET | `/tickets` | any | Author: own. Admin: all. Filters `status, category, priority, assignee=me\|unassigned, from, to, q`, `sort=urgency\|newest\|oldest` |
| POST | `/tickets` | author | Raise a ticket; classification runs in the background |
| GET | `/tickets/:id` | any | Ticket + thread (notes and triage fields admin-only) |
| PATCH | `/tickets/:id` | admin | `status`, `category`, `priority`, `assigneeId` (`"me"`, admin id, or `null`) |
| POST | `/tickets/:id/messages` | any | Reply; admins can set `isInternal: true` |
| GET | `/tickets/:id/draft` | admin | Stored or new AI draft, or `{status:"unavailable", reason}` |
| POST | `/tickets/:id/draft` | admin | Force a fresh draft |
| POST | `/tickets/:id/classify` | admin | Re-run AI classification (`?force=true` overrides admin labels) |
| GET | `/events` | any | SSE stream of changed ticket ids visible to the caller |
| GET | `/admin/ai-usage` | admin | Usage and estimated spend |

Errors are always `{ "error": { "code", "message", "details"? } }` with 401, 403, 404, 409, 422 or 500. Validation errors list each failing field.

## Deploying

Step-by-step guide: [DEPLOY.md](DEPLOY.md).

The app is set up for **Vercel + Neon** (any Node host with Postgres works):

1. Create a Neon database and copy the pooled and direct connection strings.
2. Import the repo in Vercel and set the environment variables above. The `vercel-build` script runs `prisma migrate deploy` before `next build`.
3. Seed once from your machine against the production database: `DATABASE_URL=… DIRECT_URL=… npm run db:seed`.

## Assumptions

- The dataset has no passwords or admins, so the seed sets one demo password for every account and creates two admins.
- ISBNs in the dataset are masked (`978-93-5XXXX-…`), so they're stored as text and not validated.
- "Overdue" means pending ≥ ₹1,000 and no payout for more than one quarter + 45 days. The dataset's last payouts are in 2025, so most books with a balance show as overdue today. That's correct for the data, and it's the kind of case the drafts are built to own.
- Attachments are UI-only as allowed by the brief: the file name is stored so the team can ask for it.
- Authors can reply on their own tickets. A reply re-opens a resolved ticket; closed tickets ask for a new one.
- The seed's demo tickets are labelled by the fallback rules, so seeding needs no API key.

## Known limitations and next steps

- The classifier eval uses the brief's 9 sample queries. A larger set built from real, anonymised tickets would give a more reliable accuracy number.
- No rate limiting on login, and no password reset. Both are needed before real use.
- SSE uses DB polling. On a long-lived server, switch to Postgres `LISTEN/NOTIFY` or Redis pub/sub with no client changes.
- Classification in `after()` has no retry queue. A durable job queue (or a sweep that re-classifies `PENDING`/`FALLBACK` tickets) would make it fully reliable.
- No email notifications to authors on reply yet.
- No end-to-end browser tests; coverage is unit tests plus the manual checks above.
- On Next.js 15.5 (latest patch). `npm audit` still lists a PostCSS advisory for the copy bundled inside Next; it only processes this app's own CSS at build time, and the fix requires the Next 16 major upgrade.
