"use client";

import { useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import {
  formatUsdFromCents,
  rentChargeStatusLabel,
} from "@/lib/format";

function formatDueDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
    new Date(timestamp),
  );
}

export default function LandlordRentPage() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId") as Id<"orgs"> | null;
  const charges = useQuery(api.rent.listForOrg, orgId ? { orgId } : "skip");

  if (!orgId) {
    return <p className="text-neutral-600">Select an organization.</p>;
  }

  if (charges === undefined) {
    return <p className="text-neutral-600">Loading rent schedule…</p>;
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Rent schedule
      </h2>
      <p className="mt-2 text-neutral-600">
        Monthly rent charges across active leases.
      </p>
      {charges.length === 0 ? (
        <p className="mt-8 text-neutral-600">No rent charges yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-neutral-200">
          {charges.map((charge) => (
            <li key={charge._id} className="py-4">
              <p className="text-lg text-neutral-900">
                {charge.renterName} · {charge.listingTitle}
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                {charge.periodKey} · due {formatDueDate(charge.dueDate)} ·{" "}
                {formatUsdFromCents(charge.amountCents)} ·{" "}
                {rentChargeStatusLabel(charge.status)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
