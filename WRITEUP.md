# Approach

**What I prioritised.** The brief weights AI integration and architecture highest, and the real problem is an ops team that falls behind during busy periods. So I put the effort into three things: getting every ticket in front of the right person quickly (classification and urgency sorting), making the first reply nearly free to write without making it generic (grounded drafts), and making sure none of that can stop the support desk from working when the AI provider has a bad day.

**Grounding over prompting harder.** The tone guide asks for specific numbers, dates and timelines. A model can only do that if it has them, so the draft prompt carries the author's actual record for the relevant category: royalty earned, paid and pending, last payout, the next payout deadline computed from the quarterly + 45-day rule, and flags for "below the ₹1,000 threshold" and "likely overdue". Royalty questions, the most common category, then get answers like "₹2,546 is pending and it's past our normal cycle; we'll resolve it within 48 hours" instead of a policy recital.

**Trade-offs I made.**
- *One Next.js app instead of a separate frontend and backend.* It's faster to build and deploy, with shared validation and types. Business logic is kept out of route handlers so the split stays easy later.
- *SSE backed by DB polling instead of pub/sub.* It's correct on serverless hosting, where an in-memory emitter would silently miss events. It costs one indexed query every 2 s per open tab, which is fine at this scale and easy to replace.
- *Keyword fallback rules instead of failing.* They're less accurate than the model, but tickets still land in roughly the right queue during an outage. Each fallback label is marked so admins know to check it.
- *Drafts on demand, cached by prompt hash.* Generating drafts for every ticket up front would spend money on tickets an agent closes in one line. Drafting when the ticket is opened and reusing the draft until something changes spends tokens only where they help.
- *No real file upload, password reset or rate limiting.* These were out of scope for the brief, and they're listed in the README.

**Taking it to production.**
1. Run classification on a durable job queue with retries, plus a sweep that re-classifies tickets still marked pending or fallback.
2. Build an eval set from real, anonymised tickets with the ops lead's labels. Track classification accuracy and the "draft edited before sending" rate per prompt version, and change prompts only when those numbers improve.
3. Notify authors by email or WhatsApp when a reply lands, with a link back to the ticket.
4. Connect the author record to the real royalty ledger and production system. The draft is only as specific as the data behind it.
5. Add auth hardening (rate limits, reset flow, SSO for staff), audit logging of admin actions, and per-agent SLA dashboards.
6. Explore auto-resolving the safest categories (e.g. "how do I update my description") with a human spot-check, once the edit rate shows the drafts are trustworthy.
