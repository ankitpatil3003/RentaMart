"use client";

import { useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useTransition } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatUsdFromCents, paymentTypeLabel, statusLabel } from "@/lib/format";
import { SiteHeader } from "@/components/SiteHeader";

type PaymentRow = FunctionReturnType<
  typeof api.payments.listForApplication
>[number];

export function ApplicationStatusView({
  applicationId,
}: {
  applicationId: Id<"applications">;
}) {
  const application = useQuery(api.applications.getMine, { applicationId });
  const payments = useQuery(api.payments.listForApplication, { applicationId });
  const payment = useQuery(api.payments.getByApplication, { applicationId });
  const listing = useQuery(
    api.listings.getById,
    application ? { listingId: application.listingId } : "skip",
  );
  const createAppFeeCheckout = useAction(
    api.paymentsActions.createApplicationFeeCheckout,
  );
  const createDepositCheckout = useAction(
    api.paymentsActions.createDepositCheckout,
  );
  const createFirstMonthCheckout = useAction(
    api.paymentsActions.createFirstMonthCheckout,
  );
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

  const canPayAppFee =
    application.status === "submitted" ||
    application.status === "fee_pending" ||
    application.status === "fee_failed";

  const canPayDeposit = application.status === "deposit_due";
  const canPayFirstMonth = application.status === "first_month_due";

  const depositPayment = payments?.find(
    (p: PaymentRow) => p.type === "deposit",
  );
  const firstMonthPayment = payments?.find(
    (p: PaymentRow) => p.type === "first_month",
  );

  function startCheckout(
    action: (args: { applicationId: Id<"applications"> }) => Promise<{ url: string }>,
  ) {
    startTransition(async () => {
      const { url } = await action({ applicationId });
      window.location.href = url;
    });
  }

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
        {application.status === "under_review" ? (
          <p className="mt-2 text-neutral-600">
            Application fee paid. Your application is under landlord review.
          </p>
        ) : null}
        {payment ? (
          <p className="mt-2 text-neutral-600">
            Application fee: {payment.status} ·{" "}
            {formatUsdFromCents(payment.amountCents)}
          </p>
        ) : null}
        {payments && payments.length > 0 ? (
          <div className="mt-4 rounded-md border border-neutral-200 p-4">
            <p className="text-sm font-medium text-neutral-900">Payment ledger</p>
            <ul className="mt-2 space-y-1 text-sm text-neutral-600">
              {payments.map((row: PaymentRow) => (
                <li key={row._id}>
                  {paymentTypeLabel(row.type)}: {row.status} ·{" "}
                  {formatUsdFromCents(row.amountCents)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mt-4 text-sm text-neutral-500">
          Payment status updates only after Stripe confirms via webhook. This
          page never marks a payment complete by itself.
        </p>
        {canPayAppFee ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startCheckout(createAppFeeCheckout)}
            className="mt-8 rounded-md bg-neutral-900 px-5 py-3 text-white disabled:opacity-50"
          >
            {isPending ? "Starting checkout…" : "Pay application fee"}
          </button>
        ) : null}
        {canPayDeposit ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startCheckout(createDepositCheckout)}
            className="mt-4 block rounded-md bg-neutral-900 px-5 py-3 text-white disabled:opacity-50"
          >
            {isPending
              ? "Starting checkout…"
              : `Pay deposit${
                  depositPayment
                    ? ` (${formatUsdFromCents(depositPayment.amountCents)})`
                    : listing
                      ? ` (${formatUsdFromCents(listing.rentCents)})`
                      : ""
                }`}
          </button>
        ) : null}
        {canPayFirstMonth ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startCheckout(createFirstMonthCheckout)}
            className="mt-4 block rounded-md bg-neutral-900 px-5 py-3 text-white disabled:opacity-50"
          >
            {isPending
              ? "Starting checkout…"
              : `Pay first month${
                  firstMonthPayment
                    ? ` (${formatUsdFromCents(firstMonthPayment.amountCents)})`
                    : listing
                      ? ` (${formatUsdFromCents(listing.rentCents)})`
                      : ""
                }`}
          </button>
        ) : null}
        {application.status === "move_in_ready" ? (
          <p className="mt-8 text-neutral-800">
            All payments received. You are move-in ready.
          </p>
        ) : null}
        {application.status === "denied" ? (
          <p className="mt-8 text-neutral-800">
            This application was not approved.
          </p>
        ) : null}
      </div>
    </main>
  );
}
