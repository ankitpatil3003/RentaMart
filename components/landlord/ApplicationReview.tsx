"use client";

import { useMutation, useQuery } from "convex/react";
import { FormEvent, useState, useTransition } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { landlordApi } from "@/lib/landlord/api";
import { statusLabel } from "@/lib/format";
import { ScreeningStubPanel } from "@/components/landlord/ScreeningStubPanel";

export function ApplicationReview({
  orgId,
  applicationId,
}: {
  orgId: Id<"orgs">;
  applicationId: Id<"applications">;
}) {
  const review = useQuery(landlordApi.applications.getForOrgReview, {
    orgId,
    applicationId,
  });
  const approve = useMutation(landlordApi.applications.approve);
  const deny = useMutation(landlordApi.applications.deny);
  const [denyReason, setDenyReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (review === undefined) {
    return <p className="mt-8 text-neutral-600">Loading application…</p>;
  }

  if (review === null) {
    return <p className="mt-8 text-neutral-600">Application not found.</p>;
  }

  const canDecide =
    review.status === "under_review" || review.status === "fee_paid";

  function onApprove() {
    setError(null);
    startTransition(async () => {
      try {
        await approve({ orgId, applicationId });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not approve");
      }
    });
  }

  function onDeny(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await deny({
          orgId,
          applicationId,
          reason: denyReason.trim() || undefined,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not deny");
      }
    });
  }

  return (
    <div className="mt-8">
      <p className="text-lg text-neutral-900">
        Status: {statusLabel(review.status)}
      </p>
      <p className="mt-2 text-neutral-600">
        Listing: {review.listing.title} · {review.listing.city},{" "}
        {review.listing.state}
      </p>
      <dl className="mt-6 grid gap-3 text-sm text-neutral-700 sm:grid-cols-2">
        <div>
          <dt className="text-neutral-500">Applicant</dt>
          <dd>{review.fullName}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Email</dt>
          <dd>{review.email}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Phone</dt>
          <dd>{review.phone}</dd>
        </div>
      </dl>
      {review.message ? (
        <p className="mt-6 text-neutral-700">
          Message: <span className="text-neutral-600">{review.message}</span>
        </p>
      ) : null}

      <ScreeningStubPanel orgId={orgId} applicationId={applicationId} />

      {canDecide ? (
        <section className="mt-10 border-t border-neutral-200 pt-8">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Decision
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Human only. AI assist never approves or denies.
          </p>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
          <div className="mt-6 flex flex-wrap items-start gap-6">
            <button
              type="button"
              disabled={isPending}
              onClick={onApprove}
              className="rounded-md bg-neutral-900 px-5 py-3 text-white disabled:opacity-50"
            >
              {isPending ? "Working…" : "Approve"}
            </button>
            <form onSubmit={onDeny} className="grid max-w-sm gap-3">
              <label className="block text-sm text-neutral-600">
                Deny reason (optional)
                <input
                  value={denyReason}
                  onChange={(e) => setDenyReason(e.target.value)}
                  className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
                />
              </label>
              <button
                type="submit"
                disabled={isPending}
                className="border border-neutral-900 px-5 py-3 text-neutral-900 disabled:opacity-50"
              >
                Deny
              </button>
            </form>
          </div>
        </section>
      ) : null}
    </div>
  );
}
