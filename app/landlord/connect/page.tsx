"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { ConnectStatus } from "@/components/landlord/ConnectStatus";
import { landlordApi } from "@/lib/landlord/api";
import { withOrgId } from "@/lib/landlord/paths";

export default function LandlordConnectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orgId = searchParams.get("orgId") as Id<"orgs"> | null;
  const returned = searchParams.get("return") === "1";
  const refreshed = searchParams.get("refresh") === "1";
  const orgs = useQuery(landlordApi.orgs.listMine);
  const role = orgId
    ? orgs?.find((row) => row._id === orgId)?.role
    : undefined;

  useEffect(() => {
    if (!orgId || orgs === undefined) return;
    if (role !== "org_owner") {
      router.replace(withOrgId("/landlord", orgId));
    }
  }, [orgId, orgs, role, router]);

  if (!orgId) {
    return <p className="text-neutral-600">Select an organization.</p>;
  }

  if (orgs === undefined) {
    return <p className="text-neutral-600">Loading…</p>;
  }

  if (role !== "org_owner") {
    return (
      <p className="text-neutral-600">
        Only the organization owner can manage Stripe Connect. Redirecting…
      </p>
    );
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
