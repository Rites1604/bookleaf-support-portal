"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { BookDto } from "@/lib/types";
import { inr, PAYOUT_THRESHOLD_INR, PRODUCTION_STAGES } from "@/lib/domain";
import { Badge, EmptyState, fmtDate } from "@/components/ui";

export default function MyBooksPage() {
  const [books, setBooks] = useState<BookDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<BookDto[]>("/books").then(setBooks).catch((e) => setError(e.message));
  }, []);

  if (error) return <EmptyState title="We couldn't load your books">{error}</EmptyState>;
  if (!books) return <p className="text-sm text-slate-500">Loading your books…</p>;
  if (!books.length) return <EmptyState title="No books yet">Once your manuscript is received it will show up here.</EmptyState>;

  const published = books.filter((b) => !b.inProduction);
  const totals = published.reduce(
    (t, b) => ({ sold: t.sold + b.copiesSold, earned: t.earned + b.royaltyEarned, paid: t.paid + b.royaltyPaid, pending: t.pending + b.royaltyPending }),
    { sold: 0, earned: 0, paid: 0, pending: 0 },
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">My Books</h1>

      {published.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Copies sold" value={totals.sold.toLocaleString("en-IN")} />
          <Stat label="Royalty earned" value={inr(totals.earned)} />
          <Stat label="Royalty paid" value={inr(totals.paid)} />
          <Stat label="Royalty pending" value={inr(totals.pending)} highlight={totals.pending > 0} />
        </div>
      )}

      <div className="space-y-4">
        {books.map((b) => (b.inProduction ? <ProductionCard key={b.id} book={b} /> : <PublishedCard key={b.id} book={b} />))}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${highlight ? "font-bold text-ink" : ""}`}>{value}</p>
    </div>
  );
}

function BookHeader({ book, badge }: { book: BookDto; badge: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="font-semibold">{book.title}</h2>
        <p className="text-sm text-slate-500">
          {book.genre} · ISBN {book.isbn}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {badge}
        <Link href={`/author/tickets/new?book=${book.id}`} className="btn-secondary">
          Ask about this book
        </Link>
      </div>
    </div>
  );
}

function PublishedCard({ book }: { book: BookDto }) {
  const r = book.royalty!;
  return (
    <div className="card p-5">
      <BookHeader book={book} badge={<Badge className="bg-emerald-100 text-emerald-800">Published &amp; Live</Badge>} />
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <Field label="Published" value={fmtDate(book.publicationDate)} />
        <Field label="MRP" value={inr(book.mrp)} />
        <Field label="Copies sold" value={book.copiesSold.toLocaleString("en-IN")} />
        <Field label="Royalty / copy" value={inr(book.royaltyPerCopy)} />
        <Field label="Royalty earned" value={inr(book.royaltyEarned)} />
        <Field label="Royalty paid" value={inr(book.royaltyPaid)} />
        <Field label="Royalty pending" value={inr(book.royaltyPending)} />
        <Field label="Last payout" value={book.lastPayoutDate ? fmtDate(book.lastPayoutDate) : "Not yet paid"} />
      </dl>
      <PayoutNote r={r} />
      {book.availableOn.length > 0 && <p className="mt-3 text-xs text-slate-500">Available on {book.availableOn.join(" · ")}</p>}
    </div>
  );
}

/** Answers "when do I get paid?" before the author has to raise a ticket about it. */
function PayoutNote({ r }: { r: NonNullable<BookDto["royalty"]> }) {
  if (r.pending === 0) return <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">All royalties to date have been paid out.</p>;
  if (r.belowThreshold)
    return (
      <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
        {inr(r.pending)} is below the {inr(PAYOUT_THRESHOLD_INR)} minimum payout, so it rolls over and is paid once your balance crosses the threshold.
      </p>
    );
  return (
    <p className={`mt-4 rounded-md px-3 py-2 text-sm ${r.likelyOverdue ? "bg-amber-50 text-amber-800" : "bg-brand-50 text-brand-800"}`}>
      {inr(r.pending)} is due in the next quarterly payout, by {fmtDate(r.nextPayoutBy)}.
      {r.likelyOverdue && " This looks later than our usual cycle. If you haven't heard from us, raise a ticket and we'll check it within 48 hours."}
    </p>
  );
}

function ProductionCard({ book }: { book: BookDto }) {
  const current = PRODUCTION_STAGES.findIndex((s) => s === book.productionStage);
  return (
    <div className="card p-5">
      <BookHeader book={book} badge={<Badge className="bg-amber-100 text-amber-800">In production · {book.productionStage}</Badge>} />
      <ol className="mt-5 flex flex-wrap gap-y-2 text-xs">
        {PRODUCTION_STAGES.map((s, i) => (
          <li key={s} className="flex items-center">
            <span
              className={`rounded-full px-2.5 py-1 ${
                i < current ? "bg-brand-100 text-brand-800" : i === current ? "bg-amber-500 font-semibold text-white" : "bg-slate-100 text-slate-400"
              }`}
            >
              {s}
            </span>
            {i < PRODUCTION_STAGES.length - 1 && <span className="mx-1 text-slate-300">→</span>}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm text-slate-500">Sales and royalty figures will appear here once the book is published and live.</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
