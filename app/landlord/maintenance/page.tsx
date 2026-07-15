"use client";

import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { maintenanceStatusLabel } from "@/lib/format";

export default function LandlordMaintenancePage() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId") as Id<"orgs"> | null;
  const requests = useQuery(
    api.maintenance.listForOrg,
    orgId ? { orgId } : "skip",
  );
  const updateStatus = useMutation(api.maintenance.updateStatus);
  const [isPending, startTransition] = useTransition();

  if (!orgId) {
    return <p className="text-neutral-600">Select an organization.</p>;
  }

  if (requests === undefined) {
    return <p className="text-neutral-600">Loading maintenance…</p>;
  }

  function setStatus(
    requestId: Id<"maintenanceRequests">,
    status: "open" | "in_progress" | "resolved",
  ) {
    startTransition(async () => {
      await updateStatus({ requestId, orgId: orgId!, status });
    });
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Maintenance
      </h2>
      <p className="mt-2 text-neutral-600">
        Review and update renter maintenance requests.
      </p>
      {requests.length === 0 ? (
        <p className="mt-8 text-neutral-600">No maintenance requests.</p>
      ) : (
        <ul className="mt-8 divide-y divide-neutral-200">
          {requests.map((request) => (
            <li key={request._id} className="py-4">
              <p className="text-lg text-neutral-900">{request.title}</p>
              <p className="mt-1 text-sm text-neutral-600">
                {request.renterName} · {request.listingTitle} ·{" "}
                {maintenanceStatusLabel(request.status)} · {request.priority}
              </p>
              <p className="mt-2 text-sm text-neutral-700">
                {request.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["open", "in_progress", "resolved"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={isPending || request.status === status}
                    onClick={() => setStatus(request._id, status)}
                    className="rounded-md border border-neutral-300 px-3 py-1 text-sm disabled:opacity-50"
                  >
                    {maintenanceStatusLabel(status)}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
