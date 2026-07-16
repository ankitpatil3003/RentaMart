"use client";

import { useQuery } from "convex/react";
import { useEffect, useState, useTransition } from "react";
import { api } from "@/convex/_generated/api";

type SearchAssistProps = {
  onApply: (filters: {
    city?: string;
    maxRentCents?: number;
    minBeds?: number;
  }) => void;
};

export function SearchAssist({ onApply }: SearchAssistProps) {
  const [prompt, setPrompt] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [isPending, startTransition] = useTransition();
  const parsed = useQuery(
    api.ai.parseSearchLocal,
    submitted ? { prompt: submitted } : "skip",
  );

  useEffect(() => {
    if (!parsed || parsed.disabled) return;
    onApply({
      city: parsed.city,
      maxRentCents: parsed.maxRentCents,
      minBeds: parsed.minBeds,
    });
  }, [parsed, onApply]);

  return (
    <div className="mt-6 border-t border-neutral-200 pt-6">
      <label className="block text-sm text-neutral-600">
        Ask RentaMart
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="2 beds in Denver under $2500"
          className="mt-1 w-full border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-neutral-900"
        />
      </label>
      <button
        type="button"
        disabled={!prompt.trim() || isPending}
        onClick={() => {
          startTransition(() => {
            setSubmitted(prompt.trim());
          });
        }}
        className="mt-3 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        Apply suggestion
      </button>
      {parsed && !parsed.disabled ? (
        <p className="mt-2 text-sm text-neutral-600">{parsed.explanation}</p>
      ) : null}
    </div>
  );
}
