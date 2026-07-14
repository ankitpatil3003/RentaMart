"use client";

import { useSearchParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { ConnectStatus } from "@/components/landlord/ConnectStatus";

export default function LandlordConnectPage() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId") as Id<"orgs"> | null;
  const returned = searchParams.get("return") === "1";
  const refreshed = searchParams.get("refresh") === "1";

  if (!orgId) {
    return <p className="text-neutral-600">Select an organization.</p>;
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Stripe Connect
      </h2>
      <p className="mt-2 text-neutral-600">
        Onboard in Stripe test mode so you can publish listings and receive
        deposit and first-month payments.
      </p>
      {returned ? (
        <p className="mt-4 text-sm text-neutral-700">
          Returned from Stripe. Refresh status if Connect still shows incomplete.
        </p>
      ) : null}
      {refreshed ? (
        <p className="mt-4 text-sm text-neutral-700">
          Onboarding link expired or was refreshed. Start setup again if needed.
        </p>
      ) : null}
      <ConnectStatus orgId={orgId} />
    </div>
  );
}
