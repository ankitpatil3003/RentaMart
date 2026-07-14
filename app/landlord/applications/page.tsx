"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { statusLabel } from "@/lib/format";
import { landlordApi } from "@/lib/landlord/api";
import { withOrgId } from "@/lib/landlord/paths";

export default function LandlordApplicationsPage() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId") as Id<"orgs"> | null;
  const inbox = useQuery(
    landlordApi.applications.listInboxForOrg,
    orgId ? { orgId } : "skip",
  );

  if (!orgId) {
    return <p className="text-neutral-600">Select an organization.</p>;
  }

  if (inbox === undefined) {
    return <p className="text-neutral-600">Loading inbox…</p>;
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Applications
      </h2>
      <p className="mt-2 text-neutral-600">
        Review applications that are ready for a decision.
      </p>
      <section className="mt-8">
        {inbox.length === 0 ? (
          <p className="text-neutral-600">No applications in review.</p>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {inbox.map((app) => (
              <li key={app._id} className="py-4">
                <Link
                  href={withOrgId(`/landlord/applications/${app._id}`, orgId)}
                  className="text-lg text-neutral-900 hover:underline"
                >
                  {app.fullName}
                </Link>
                <p className="mt-1 text-sm text-neutral-600">
                  {app.listingTitle} · {statusLabel(app.status)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
