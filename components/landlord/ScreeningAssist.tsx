"use client";

import { useAction, useQuery } from "convex/react";
import { useState, useTransition } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { landlordApi } from "@/lib/landlord/api";

export function ScreeningAssist({
  applicationId,
  reportId,
}: {
  applicationId: Id<"applications">;
  reportId: Id<"screeningReports">;
}) {
  const ai = useQuery(api.ai.isEnabled);
  const assist = useAction(landlordApi.aiActions.screeningAssist);
  const [result, setResult] = useState<{
    summary: string;
    missingDocs: string[];
    suggestedQuestions: string[];
    disabled: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!ai?.enabled) {
    return null;
  }

  return (
    <div className="mt-6 border-t border-neutral-200 pt-6">
      <h3 className="text-lg font-medium text-neutral-900">AI screening assist</h3>
      <p className="mt-1 text-sm text-neutral-600">
        Suggestions only. Approve and deny stay human decisions.
      </p>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const dto = await assist({ applicationId, reportId });
              setResult(dto);
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Assist unavailable",
              );
            }
          });
        }}
        className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {isPending ? "Working…" : "Run AI assist"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {result ? (
        <div className="mt-4 space-y-3 text-sm text-neutral-700">
          {result.disabled ? (
            <p>AI assist is turned off for this environment.</p>
          ) : (
            <>
              <p>{result.summary}</p>
              {result.missingDocs.length > 0 ? (
                <div>
                  <p className="font-medium text-neutral-900">Missing docs</p>
                  <ul className="mt-1 list-disc pl-5">
                    {result.missingDocs.map((doc) => (
                      <li key={doc}>{doc}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {result.suggestedQuestions.length > 0 ? (
                <div>
                  <p className="font-medium text-neutral-900">
                    Suggested questions
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {result.suggestedQuestions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
