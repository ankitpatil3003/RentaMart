"use client";

import { useAction } from "convex/react";
import { FormEvent, useState, useTransition } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function ListingQa({ listingId }: { listingId: Id<"listings"> }) {
  const askListing = useAction(api.aiActions.askListing);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await askListing({
          listingId,
          question: question.trim(),
        });
        setAnswer(result.answer);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not ask");
      }
    });
  }

  return (
    <section className="mt-12 border-t border-neutral-200 pt-8">
      <h2 className="text-2xl font-semibold tracking-tight">Ask about this home</h2>
      <form onSubmit={onSubmit} className="mt-4 max-w-md">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Is laundry in unit?"
          className="w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
        />
        <button
          type="submit"
          disabled={!question.trim() || isPending}
          className="mt-3 rounded-md border border-neutral-900 px-4 py-2 text-sm disabled:opacity-50"
        >
          Ask
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {answer ? (
        <p className="mt-4 max-w-2xl leading-relaxed text-neutral-700">{answer}</p>
      ) : null}
    </section>
  );
}
