"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiClientError } from "@/lib/api";
import type { BookDto, TicketDto } from "@/lib/types";

const GENERAL = "__general__";

function NewTicketForm() {
  const router = useRouter();
  const preselected = useSearchParams().get("book");
  const [books, setBooks] = useState<BookDto[]>([]);
  const [bookId, setBookId] = useState(preselected ?? "");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<BookDto[]>("/books").then(setBooks).catch(() => setBooks([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!bookId) return setErrors({ bookId: "Choose a book, or General / Account Level" });
    setBusy(true);
    setErrors({});
    try {
      const ticket = await api<TicketDto>("/tickets", {
        method: "POST",
        json: {
          bookId: bookId === GENERAL ? null : bookId,
          subject,
          description,
          // Attachment upload is out of scope; we record the file name so the team can ask for it.
          attachmentName: file?.name,
        },
      });
      router.push(`/author/tickets/${ticket.id}`);
    } catch (err) {
      setErrors(err instanceof ApiClientError ? { ...err.fieldErrors(), form: err.message } : { form: "Could not submit. Please try again." });
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold">Get help</h1>
      <p className="mb-6 text-sm text-slate-500">Tell us what’s going on. Our team usually responds within one working day, and you’ll see the reply on the ticket.</p>

      <form onSubmit={submit} className="card space-y-5 p-6">
        <div>
          <label className="label" htmlFor="book">Which book is this about?</label>
          <select id="book" className="input" value={bookId} onChange={(e) => setBookId(e.target.value)}>
            <option value="">Select…</option>
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} {b.inProduction ? `(in production: ${b.productionStage})` : ""}
              </option>
            ))}
            <option value={GENERAL}>General / Account Level</option>
          </select>
          {errors.bookId && <p className="field-error">{errors.bookId}</p>}
        </div>

        <div>
          <label className="label" htmlFor="subject">Subject</label>
          <input id="subject" className="input" maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Royalty for last quarter not received" />
          {errors.subject && <p className="field-error">{errors.subject}</p>}
        </div>

        <div>
          <label className="label" htmlFor="description">Details</label>
          <textarea
            id="description"
            className="input min-h-40"
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened, when, and anything you've already tried. For print issues, mention which pages are affected."
          />
          <div className="flex justify-between">
            {errors.description ? <p className="field-error">{errors.description}</p> : <span />}
            <span className="mt-1 text-xs text-slate-400">{description.length}/5000</span>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="file">Attachment (optional)</label>
          <input id="file" type="file" accept="image/*,.pdf" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <p className="mt-1 text-xs text-slate-400">Photos of a defective copy or a screenshot of a listing help us resolve things faster.</p>
        </div>

        {errors.form && !Object.keys(errors).some((k) => k !== "form") && <p className="text-sm text-red-600">{errors.form}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? "Submitting…" : "Submit ticket"}</button>
        </div>
      </form>
    </div>
  );
}

export default function NewTicketPage() {
  return (
    <Suspense>
      <NewTicketForm />
    </Suspense>
  );
}
