"use client";

import { useState, useTransition } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export default function AdminLandlordRequestsPage() {
  const pending = useQuery(api.landlordRequests.listPending);
  const approve = useMutation(api.landlordRequests.approve);
  const deny = useMutation(api.landlordRequests.deny);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (pending === undefined) {
    return <p className="text-neutral-600">Loading requests…</p>;
  }

  if (pending.length === 0) {
    return <p className="text-neutral-600">No pending landlord requests.</p>;
  }

  function run(
    requestId: Id<"landlordRequests">,
    action: "approve" | "deny",
  ) {
    setError(null);
    startTransition(async () => {
      try {
        const adminNote = notes[requestId]?.trim() || undefined;
        if (action === "approve") {
          await approve({ requestId, adminNote });
        } else {
          await deny({ requestId, adminNote });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <div className="grid gap-6">
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Landlord requests
      </h2>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {pending.map((row) => (
        <article
          key={row._id}
          className="border border-neutral-200 bg-white px-4 py-4"
        >
          <h3 className="text-lg font-medium text-neutral-900">{row.orgName}</h3>
          <p className="mt-1 text-sm text-neutral-600">
            {row.userName ? `${row.userName} · ` : ""}
            {row.userEmail}
            {row.contactPhone ? ` · ${row.contactPhone}` : ""}
          </p>
          {row.notes ? (
            <p className="mt-2 text-sm text-neutral-700">{row.notes}</p>
          ) : null}
          {row.documentUrls.length > 0 ? (
            <ul className="mt-3 list-inside list-disc text-sm">
              {row.documentUrls.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    View document
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <label className="mt-4 block text-sm text-neutral-600">
            Admin note
            <input
              value={notes[row._id] ?? ""}
              onChange={(e) =>
                setNotes((prev) => ({ ...prev, [row._id]: e.target.value }))
              }
              className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(row._id, "approve")}
              className="rounded-md bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(row._id, "deny")}
              className="border border-neutral-900 px-4 py-2 text-neutral-900 disabled:opacity-50"
            >
              Deny
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
