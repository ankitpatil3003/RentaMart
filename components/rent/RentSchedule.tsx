"use client";

import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  formatUsdFromCents,
  rentChargeStatusLabel,
} from "@/lib/format";
import { SiteHeader } from "@/components/SiteHeader";

function formatDueDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
    new Date(timestamp),
  );
}

export function RentSchedule() {
  const searchParams = useSearchParams();
  const checkoutParam = searchParams.get("checkout");
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const profileReady = isAuthenticated && me !== undefined && me !== null;

  const charges = useQuery(
    api.rent.listForRenter,
    profileReady ? {} : "skip",
  );
  const backfill = useMutation(api.leases.backfillMine);
  const createRentCheckout = useAction(api.paymentsActions.createRentCheckout);
  const syncRentCheckout = useAction(api.paymentsActions.syncRentCheckoutStatus);
  const [isPending, startTransition] = useTransition();
  const [payError, setPayError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const backfilled = useRef(false);
  const autoSynced = useRef(false);

  useEffect(() => {
    if (!profileReady || backfilled.current) return;
    backfilled.current = true;
    void backfill({});
  }, [profileReady, backfill]);

  useEffect(() => {
    if (!profileReady || autoSynced.current || checkoutParam !== "success") {
      return;
    }
    autoSynced.current = true;
    startTransition(async () => {
      try {
        const result = await syncRentCheckout({});
        setSyncMessage(result.message);
      } catch (error) {
        setSyncMessage(
          error instanceof Error
            ? error.message
            : "Could not refresh rent payment status",
        );
      }
    });
  }, [checkoutParam, profileReady, syncRentCheckout]);

  function payRent(rentChargeId: Id<"rentCharges">) {
    setPayError(null);
    startTransition(async () => {
      try {
        const { url } = await createRentCheckout({ rentChargeId });
        window.location.href = url;
      } catch (error) {
        setPayError(
          error instanceof Error ? error.message : "Could not start rent checkout",
        );
      }
    });
  }

  function refreshRentStatus() {
    setSyncMessage(null);
    startTransition(async () => {
      try {
        const result = await syncRentCheckout({});
        setSyncMessage(result.message);
      } catch (error) {
        setSyncMessage(
          error instanceof Error
            ? error.message
            : "Could not refresh rent payment status",
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
          Sign in to view your rent schedule.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f5f1_0%,#ffffff_40%)]">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight">Rent schedule</h1>
        <p className="mt-2 text-neutral-600">
          Monthly rent after move-in. Your first month was already paid during
          move-in, so that period shows as paid.
        </p>
        {checkoutParam === "success" ? (
          <p className="mt-2 text-sm text-neutral-700">
            Returned from Stripe. Confirming rent payment…
          </p>
        ) : null}
        {syncMessage ? (
          <p className="mt-2 text-sm text-neutral-700">{syncMessage}</p>
        ) : null}
        {payError ? (
          <p className="mt-2 text-sm text-red-700">{payError}</p>
        ) : null}
        {charges?.some((c) => c.status === "checkout_open") ? (
          <button
            type="button"
            disabled={isPending}
            onClick={refreshRentStatus}
            className="mt-4 rounded-md border border-neutral-300 bg-white px-5 py-3 text-neutral-900 disabled:opacity-50"
          >
            {isPending ? "Refreshing…" : "Refresh rent payment status"}
          </button>
        ) : null}

        {charges === undefined ? (
          <p className="mt-8 text-neutral-600">Loading…</p>
        ) : charges.length === 0 ? (
          <p className="mt-8 text-neutral-600">
            No rent charges yet. Complete move-in payments on your application
            first.
          </p>
        ) : (
          <ul className="mt-8 divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
            {charges.map((charge) => {
              const canPay =
                charge.status === "due" || charge.status === "failed";
              return (
                <li
                  key={charge._id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div>
                    <p className="font-medium text-neutral-900">
                      {charge.listingTitle}
                    </p>
                    <p className="mt-1 text-sm text-neutral-600">
                      {charge.periodKey} · due {formatDueDate(charge.dueDate)}
                    </p>
                    <p className="mt-1 text-sm text-neutral-900">
                      {formatUsdFromCents(charge.amountCents)} ·{" "}
                      {rentChargeStatusLabel(charge.status)}
                    </p>
                  </div>
                  {canPay ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => payRent(charge._id)}
                      className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Pay rent
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
