"use client";

import { useAction, useQuery } from "convex/react";
import { useTransition } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { landlordApi } from "@/lib/landlord/api";

export function ConnectStatus({ orgId }: { orgId: Id<"orgs"> }) {
  const org = useQuery(landlordApi.orgs.get, { orgId });
  const createLink = useAction(landlordApi.orgsActions.createConnectOnboardingLink);
  const syncStatus = useAction(landlordApi.orgsActions.syncConnectStatus);
  const [isPending, startTransition] = useTransition();

  if (org === undefined) {
    return <p className="text-neutral-600">Loading Connect status…</p>;
  }

  if (org === null) {
    return <p className="text-neutral-600">Organization not found.</p>;
  }

  const statusLabel = org.connectReady
    ? "Ready (test)"
    : org.stripeConnectAccountId
      ? "Onboarding incomplete"
      : "Not started";

  return (
    <div className="mt-8 space-y-4">
      <p className="text-lg text-neutral-900">
        Status: <span className="font-medium">{statusLabel}</span>
      </p>
      <p className="text-sm text-neutral-600">
        Stripe Connect must be ready before you can publish listings. Use Stripe
        test mode for demos.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isPending || org.connectReady}
          onClick={() => {
            startTransition(async () => {
              const { url } = await createLink({ orgId });
              window.location.href = url;
            });
          }}
          className="rounded-md bg-neutral-900 px-5 py-3 text-white disabled:opacity-50"
        >
          {isPending
            ? "Working…"
            : org.connectReady
              ? "Connect complete"
              : "Complete Stripe setup"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await syncStatus({ orgId });
            });
          }}
          className="border border-neutral-900 px-5 py-3 text-neutral-900 disabled:opacity-50"
        >
          Refresh status
        </button>
      </div>
    </div>
  );
}
