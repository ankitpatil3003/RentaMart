"use client";

import { useAction, useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
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
  const searchParams = useSearchParams();
  const checkoutParam = searchParams.get("checkout");
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const profileReady = isAuthenticated && me !== undefined && me !== null;

  const application = useQuery(
    api.applications.getMine,
    profileReady ? { applicationId } : "skip",
  );
  const payments = useQuery(
    api.payments.listForApplication,
    profileReady ? { applicationId } : "skip",
  );
  const payment = useQuery(
    api.payments.getByApplication,
    profileReady ? { applicationId } : "skip",
  );
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
  const syncCheckoutStatus = useAction(api.paymentsActions.syncCheckoutStatus);
  const [isPending, startTransition] = useTransition();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const autoSynced = useRef(false);

  useEffect(() => {
    if (!profileReady || autoSynced.current || checkoutParam !== "success") {
      return;
    }
    autoSynced.current = true;
    startTransition(async () => {
      try {
        const result = await syncCheckoutStatus({ applicationId });
        setSyncMessage(result.message);
      } catch (error) {
        setSyncMessage(
          error instanceof Error
            ? error.message
            : "Could not refresh payment status",
        );
      }
    });
  }, [applicationId, checkoutParam, profileReady, syncCheckoutStatus]);

  if (authLoading || (isAuthenticated && me === undefined) || application === undefined) {
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
          Sign in as the renter who submitted this application.
        </p>
      </main>
    );
  }

  if (application === null) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <p className="px-6 py-12 text-neutral-600">
          Application not found. If you created this as a landlord, open it from
          the landlord Applications inbox instead, or sign in as the renter who
          applied.
        </p>
      </main>
    );
  }

  const canPayAppFee =
    application.status === "submitted" ||
    application.status === "fee_pending" ||
    application.status === "fee_failed";

  const canPayDeposit = application.status === "deposit_due";
  const canPayFirstMonth = application.status === "first_month_due";

  const hasOpenCheckout = payments?.some(
    (p: PaymentRow) =>
      p.status === "checkout_open" ||
      p.status === "created" ||
      p.status === "failed",
  );

  const depositPayment = payments?.find(
    (p: PaymentRow) => p.type === "deposit",
  );
  const firstMonthPayment = payments?.find(
    (p: PaymentRow) => p.type === "first_month",
  );

  function startCheckout(
    action: (args: { applicationId: Id<"applications"> }) => Promise<{ url: string }>,
  ) {
    setPayError(null);
    startTransition(async () => {
      try {
        const { url } = await action({ applicationId });
        window.location.href = url;
      } catch (error) {
        setPayError(
          error instanceof Error ? error.message : "Could not start checkout",
        );
      }
    });
  }

  function refreshPaymentStatus() {
    setSyncMessage(null);
    startTransition(async () => {
      try {
        const result = await syncCheckoutStatus({ applicationId });
        setSyncMessage(result.message);
      } catch (error) {
        setSyncMessage(
          error instanceof Error
            ? error.message
            : "Could not refresh payment status",
        );
      }
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
        {checkoutParam === "success" ? (
          <p className="mt-2 text-neutral-600">
            Returned from Stripe. Confirming payment status…
          </p>
        ) : null}
        {checkoutParam === "canceled" ? (
          <p className="mt-2 text-neutral-600">
            Checkout was canceled. You can try again when ready.
          </p>
        ) : null}
        {syncMessage ? (
          <p className="mt-2 text-sm text-neutral-700">{syncMessage}</p>
        ) : null}
        {payError ? (
          <p className="mt-2 text-sm text-red-700">{payError}</p>
        ) : null}
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
          Payment status updates after Stripe confirms (webhook) or when you
          refresh below. This page never marks a payment complete by itself.
        </p>
        {hasOpenCheckout ||
        canPayAppFee ||
        canPayDeposit ||
        canPayFirstMonth ? (
          <button
            type="button"
            disabled={isPending}
            onClick={refreshPaymentStatus}
            className="mt-6 rounded-md border border-neutral-300 bg-white px-5 py-3 text-neutral-900 disabled:opacity-50"
          >
            {isPending ? "Refreshing…" : "Refresh payment status"}
          </button>
        ) : null}
        {canPayAppFee ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startCheckout(createAppFeeCheckout)}
            className="mt-4 block rounded-md bg-neutral-900 px-5 py-3 text-white disabled:opacity-50"
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
        {application.status === "qualified" ? (
          <p className="mt-8 text-neutral-800">
            You completed all required payments and are qualified. The landlord
            will select the most qualified applicant for this unit (not
            first-come-first-served). Application fees are non-refundable.
          </p>
        ) : null}
        {application.status === "refund_eligible" ? (
          <p className="mt-8 text-neutral-800">
            Another applicant was selected for this listing. Your deposit and/or
            first month refund is processing automatically. The application fee
            is non-refundable because screening was performed.
          </p>
        ) : null}
        {application.status === "refunded" ? (
          <p className="mt-8 text-neutral-800">
            Your deposit and first month payments have been refunded.
          </p>
        ) : null}
        {application.status === "move_in_ready" ? (
          <p className="mt-8 text-neutral-800">
            All payments received. You are move-in ready.{" "}
            <a href="/rent" className="underline">
              View rent schedule
            </a>{" "}
            or{" "}
            <a href={`/messages/${applicationId}`} className="underline">
              message landlord
            </a>
            .
          </p>
        ) : null}
        {application.status === "moved" ? (
          <p className="mt-8 text-neutral-800">
            You have moved in.{" "}
            <a href="/rent" className="underline">
              View rent schedule
            </a>
            .
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
