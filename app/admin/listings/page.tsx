"use client";

import { useState, useTransition } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

export default function AdminListingsPage() {
  const pending = useQuery(api.listings.listPendingVerification);
  const approve = useMutation(api.listings.approveListing);
  const deny = useMutation(api.listings.denyListing);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (pending === undefined) {
    return <p className="text-neutral-600">Loading listings…</p>;
  }

  if (pending.length === 0) {
    return (
      <p className="text-neutral-600">No listings pending authenticity review.</p>
    );
  }

  function run(listingId: Id<"listings">, action: "approve" | "deny") {
    setError(null);
    startTransition(async () => {
      try {
        const adminNote = notes[listingId]?.trim() || undefined;
        if (action === "approve") {
          await approve({ listingId, adminNote });
        } else {
          await deny({ listingId, adminNote });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <div className="grid gap-6">
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Listing authenticity
      </h2>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {pending.map((row) => (
        <article
          key={row._id}
          className="border border-neutral-200 bg-white px-4 py-4"
        >
          <h3 className="text-lg font-medium text-neutral-900">{row.title}</h3>
          <p className="mt-1 text-sm text-neutral-600">
            {row.orgName} · {row.city}, {row.state} · {formatMoney(row.rentCents)}
            /mo
          </p>
          {row.photoUrls[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.photoUrls[0]}
              alt=""
              className="mt-3 h-40 w-full max-w-md object-cover"
            />
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
              Approve listing
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
