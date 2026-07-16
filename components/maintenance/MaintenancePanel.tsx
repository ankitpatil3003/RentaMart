"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { maintenanceStatusLabel } from "@/lib/format";
import { SiteHeader } from "@/components/SiteHeader";

export function MaintenancePanel() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const profileReady = isAuthenticated && me !== undefined && me !== null;

  const leases = useQuery(api.leases.listMine, profileReady ? {} : "skip");
  const requests = useQuery(
    api.maintenance.listForRenter,
    profileReady ? {} : "skip",
  );
  const create = useMutation(api.maintenance.create);
  const backfill = useMutation(api.leases.backfillMine);
  const [leaseId, setLeaseId] = useState<Id<"leases"> | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const backfilled = useRef(false);

  useEffect(() => {
    if (!profileReady || backfilled.current) return;
    backfilled.current = true;
    void backfill({});
  }, [profileReady, backfill]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!leaseId) return;
    setError(null);
    startTransition(async () => {
      try {
        await create({ leaseId, title, description, priority });
        setTitle("");
        setDescription("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not submit request",
        );
      }
    });
  }

  if (authLoading || (isAuthenticated && me === undefined)) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <p className="px-6 py-12 text-neutral-600">Loading…</p>
      </main>
    );
  }

  if (!isAuthenticated || me === null) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <p className="px-6 py-12 text-neutral-600">
          Sign in to manage maintenance requests.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f5f1_0%,#ffffff_40%)]">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight">Maintenance</h1>
        <p className="mt-2 text-neutral-600">
          Submit and track maintenance requests for your lease.
        </p>

        {leases === undefined || requests === undefined ? (
          <p className="mt-8 text-neutral-600">Loading…</p>
        ) : (
          <>
            {leases.length === 0 ? (
              <p className="mt-8 text-neutral-600">
                No active lease yet. Complete your application and move-in
                payments first.
              </p>
            ) : (
              <form
                onSubmit={onSubmit}
                className="mt-8 grid gap-4 rounded-md border border-neutral-200 bg-white p-5"
              >
                <h2 className="text-lg font-medium">New request</h2>
                <label className="text-sm text-neutral-600">
                  Lease
                  <select
                    required
                    value={leaseId}
                    onChange={(e) => setLeaseId(e.target.value as Id<"leases">)}
                    className="mt-1 w-full border border-neutral-300 px-3 py-2"
                  >
                    <option value="">Select lease</option>
                    {leases.map((lease) => (
                      <option key={lease._id} value={lease._id}>
                        {lease.listingTitle}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-neutral-600">
                  Title
                  <input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 w-full border border-neutral-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm text-neutral-600">
                  Description
                  <textarea
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="mt-1 w-full border border-neutral-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm text-neutral-600">
                  Priority
                  <select
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as "low" | "medium" | "high")
                    }
                    className="mt-1 w-full border border-neutral-300 px-3 py-2"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
                {error ? <p className="text-sm text-red-700">{error}</p> : null}
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-fit rounded-md bg-neutral-900 px-5 py-3 text-white disabled:opacity-50"
                >
                  {isPending ? "Submitting…" : "Submit request"}
                </button>
              </form>
            )}

            <section className="mt-8">
              <h2 className="text-lg font-medium">Your requests</h2>
              {requests.length === 0 ? (
                <p className="mt-2 text-neutral-600">No requests yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
                  {requests.map((request) => (
                    <li key={request._id} className="px-5 py-4">
                      <p className="font-medium text-neutral-900">
                        {request.title}
                      </p>
                      <p className="mt-1 text-sm text-neutral-600">
                        {request.listingTitle} ·{" "}
                        {maintenanceStatusLabel(request.status)} ·{" "}
                        {request.priority}
                      </p>
                      <p className="mt-2 text-sm text-neutral-700">
                        {request.description}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
