"use client";

import { useMutation, useQuery } from "convex/react";
import { FormEvent, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { landlordApi } from "@/lib/landlord/api";
import { statusLabel } from "@/lib/format";
import { ScreeningStubPanel } from "@/components/landlord/ScreeningStubPanel";
import { withOrgId } from "@/lib/landlord/paths";

function PaymentBadges({
  payments,
}: {
  payments: {
    feePaid: boolean;
    depositPaid: boolean;
    firstMonthPaid: boolean;
  };
}) {
  return (
    <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-neutral-500">Application fee</dt>
        <dd>{payments.feePaid ? "Paid (non-refundable)" : "Not paid"}</dd>
      </div>
      <div>
        <dt className="text-neutral-500">Deposit</dt>
        <dd>{payments.depositPaid ? "Paid" : "Not paid"}</dd>
      </div>
      <div>
        <dt className="text-neutral-500">First month</dt>
        <dd>{payments.firstMonthPaid ? "Paid" : "Not paid"}</dd>
      </div>
    </dl>
  );
}

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
  const selectApplicant = useMutation(landlordApi.applications.selectApplicant);
  const markMoved = useMutation(landlordApi.applications.markMoved);
  const processRefund = useMutation(landlordApi.refunds.processForApplication);
  const router = useRouter();
  const [denyReason, setDenyReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (review === null) {
      router.replace(withOrgId("/landlord/applications", orgId));
    }
  }, [review, router, orgId]);

  if (review === undefined) {
    return <p className="mt-8 text-neutral-600">Loading application…</p>;
  }

  if (review === null) {
    return <p className="mt-8 text-neutral-600">Redirecting…</p>;
  }

  const canDecide =
    review.status === "under_review" || review.status === "fee_paid";
  const canSelect = review.status === "qualified";
  const canMarkMoved = review.status === "move_in_ready";
  const canProcessRefund = review.status === "refund_eligible";

  function runAction(
    label: string,
    action: () => Promise<unknown>,
  ) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await action();
        setSuccess(label);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  function onApprove() {
    runAction("Applicant approved for deposit.", () =>
      approve({ orgId, applicationId }),
    );
  }

  function onDeny(event: FormEvent) {
    event.preventDefault();
    runAction("Application denied.", () =>
      deny({
        orgId,
        applicationId,
        reason: denyReason.trim() || undefined,
      }),
    );
  }

  function onSelect() {
    runAction(
      "Applicant selected. Others who paid deposit/first month are refund eligible.",
      () => selectApplicant({ orgId, applicationId }),
    );
  }

  function onMarkMoved() {
    runAction("Tenant marked as moved in.", () =>
      markMoved({ orgId, applicationId }),
    );
  }

  function onProcessRefund() {
    runAction("Refund processing started.", () =>
      processRefund({ orgId, applicationId }),
    );
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
      {review.qualifiedCountOnListing > 1 && review.status === "qualified" ? (
        <p className="mt-2 text-sm text-amber-800">
          {review.qualifiedCountOnListing} qualified applicants on this listing.
          Select the best fit — US law allows landlord choice, not
          first-come-first-served.
        </p>
      ) : null}
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
      <PaymentBadges payments={review.payments} />
      {review.message ? (
        <p className="mt-6 text-neutral-700">
          Message: <span className="text-neutral-600">{review.message}</span>
        </p>
      ) : null}

      <ScreeningStubPanel orgId={orgId} applicationId={applicationId} />

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="mt-4 text-sm text-green-800">{success}</p> : null}

      {canDecide ? (
        <section className="mt-10 border-t border-neutral-200 pt-8">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Initial review
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Approve to allow deposit payment. Deny closes this application
            (application fee is non-refundable).
          </p>
          <div className="mt-6 flex flex-wrap items-start gap-6">
            <button
              type="button"
              disabled={isPending}
              onClick={onApprove}
              className="rounded-md bg-neutral-900 px-5 py-3 text-white disabled:opacity-50"
            >
              {isPending ? "Working…" : "Approve for deposit"}
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

      {canSelect ? (
        <section className="mt-10 border-t border-neutral-200 pt-8">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Select tenant
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            This applicant completed deposit and first month. Selecting them
            moves them to move-in ready, unpublishes the listing, and
            automatically refunds deposit/first month for other qualified
            applicants (application fee is never refunded).
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={onSelect}
            className="mt-6 rounded-md bg-neutral-900 px-5 py-3 text-white disabled:opacity-50"
          >
            {isPending ? "Working…" : "Select as tenant"}
          </button>
        </section>
      ) : null}

      {canMarkMoved ? (
        <section className="mt-10 border-t border-neutral-200 pt-8">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Confirm move-in
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Mark this tenant as moved in after keys are handed over.
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={onMarkMoved}
            className="mt-6 rounded-md bg-neutral-900 px-5 py-3 text-white disabled:opacity-50"
          >
            {isPending ? "Working…" : "Mark as moved in"}
          </button>
        </section>
      ) : null}

      {canProcessRefund ? (
        <section className="mt-10 border-t border-neutral-200 pt-8">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Process refund
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Refund deposit and first month via Stripe. Application fee is not
            refunded (screening was performed).
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={onProcessRefund}
            className="mt-6 rounded-md border border-neutral-900 px-5 py-3 text-neutral-900 disabled:opacity-50"
          >
            {isPending ? "Working…" : "Process refund"}
          </button>
        </section>
      ) : null}

      {review.status === "refunded" ? (
        <p className="mt-10 text-sm text-neutral-600">
          Deposit and first month have been refunded.
        </p>
      ) : null}

      {review.status === "moved" ? (
        <p className="mt-10 text-sm text-neutral-600">
          This tenant has moved in.
        </p>
      ) : null}
    </div>
  );
}
