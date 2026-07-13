"use client";

import { useAction, useQuery } from "convex/react";
import { useTransition } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatUsdFromCents, statusLabel } from "@/lib/format";
import { SiteHeader } from "@/components/SiteHeader";

export function ApplicationStatusView({
  applicationId,
}: {
  applicationId: Id<"applications">;
}) {
  const application = useQuery(api.applications.getMine, { applicationId });
  const payment = useQuery(api.payments.getByApplication, { applicationId });
  const listing = useQuery(
    api.listings.getById,
    application ? { listingId: application.listingId } : "skip",
  );
  const createCheckout = useAction(api.paymentsActions.createApplicationFeeCheckout);
  const [isPending, startTransition] = useTransition();

  if (application === undefined) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <p className="px-6 py-12 text-neutral-600">Loading…</p>
      </main>
    );
  }

  if (application === null) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <p className="px-6 py-12 text-neutral-600">Application not found.</p>
      </main>
    );
  }

  const canPay =
    application.status === "submitted" ||
    application.status === "fee_pending" ||
    application.status === "fee_failed";

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f5f1_0%,#ffffff_40%)]">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight">Application</h1>
        {listing ? (
          <p className="mt-2 text-neutral-600">{listing.title}</p>
        ) : null}
        <p className="mt-6 text-lg text-neutral-900">
          Status: {statusLabel(application.status)}
        </p>
        {payment ? (
          <p className="mt-2 text-neutral-600">
            Fee ledger: {payment.status} ·{" "}
            {formatUsdFromCents(payment.amountCents)}
          </p>
        ) : null}
        <p className="mt-4 text-sm text-neutral-500">
          Payment status updates only after Stripe confirms via webhook. This
          page never marks a fee paid by itself.
        </p>
        {canPay ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                const { url } = await createCheckout({ applicationId });
                window.location.href = url;
              });
            }}
            className="mt-8 rounded-md bg-neutral-900 px-5 py-3 text-white disabled:opacity-50"
          >
            {isPending ? "Starting checkout…" : "Pay application fee"}
          </button>
        ) : null}
        {application.status === "fee_paid" ? (
          <p className="mt-8 text-neutral-800">
            Application fee received. A landlord review step comes in Layer 2.
          </p>
        ) : null}
      </div>
    </main>
  );
}
