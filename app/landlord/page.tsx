"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { formatUsdFromCents } from "@/lib/format";
import { landlordApi } from "@/lib/landlord/api";
import { withOrgId } from "@/lib/landlord/paths";

export default function LandlordDashboardPage() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId") as Id<"orgs"> | null;
  const org = useQuery(landlordApi.orgs.get, orgId ? { orgId } : "skip");
  const listings = useQuery(
    landlordApi.listings.listForOrg,
    orgId ? { orgId } : "skip",
  );
  const inbox = useQuery(
    landlordApi.applications.listInboxForOrg,
    orgId ? { orgId } : "skip",
  );

  if (!orgId) {
    return <p className="text-neutral-600">Select an organization.</p>;
  }

  if (org === undefined || listings === undefined || inbox === undefined) {
    return <p className="text-neutral-600">Loading dashboard…</p>;
  }

  if (org === null) {
    return <p className="text-neutral-600">Organization not found.</p>;
  }

  const draftCount = listings.filter((l) => !l.published).length;
  const publishedCount = listings.filter((l) => l.published).length;

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Dashboard
      </h2>
      <p className="mt-2 text-neutral-600">{org.name}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="border border-neutral-200 bg-white/70 p-5">
          <p className="text-sm text-neutral-500">Connect</p>
          <p className="mt-2 text-lg text-neutral-900">
            {org.connectReady ? "Ready" : "Not ready"}
          </p>
          <Link
            href={withOrgId("/landlord/connect", orgId)}
            className="mt-3 inline-block text-sm text-neutral-700 underline"
          >
            Manage Connect
          </Link>
        </div>
        <div className="border border-neutral-200 bg-white/70 p-5">
          <p className="text-sm text-neutral-500">Listings</p>
          <p className="mt-2 text-lg text-neutral-900">
            {publishedCount} published · {draftCount} draft
          </p>
          <Link
            href={withOrgId("/landlord/listings", orgId)}
            className="mt-3 inline-block text-sm text-neutral-700 underline"
          >
            View listings
          </Link>
        </div>
        <div className="border border-neutral-200 bg-white/70 p-5">
          <p className="text-sm text-neutral-500">Inbox</p>
          <p className="mt-2 text-lg text-neutral-900">
            {inbox.length} in review
          </p>
          <Link
            href={withOrgId("/landlord/applications", orgId)}
            className="mt-3 inline-block text-sm text-neutral-700 underline"
          >
            Review applications
          </Link>
        </div>
        <div className="border border-neutral-200 bg-white/70 p-5">
          <p className="text-sm text-neutral-500">Quick actions</p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link
              href={withOrgId("/landlord/listings/new", orgId)}
              className="text-neutral-700 underline"
            >
              New listing draft
            </Link>
            {!org.connectReady ? (
              <Link
                href={withOrgId("/landlord/connect", orgId)}
                className="text-neutral-700 underline"
              >
                Finish Stripe setup
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {listings.length > 0 ? (
        <section className="mt-10">
          <h3 className="text-lg font-medium text-neutral-900">
            Recent listings
          </h3>
          <ul className="mt-4 divide-y divide-neutral-200">
            {listings.slice(0, 5).map((listing) => (
              <li key={listing._id} className="py-3">
                <Link
                  href={withOrgId(
                    `/landlord/listings/${listing._id}/edit`,
                    orgId,
                  )}
                  className="text-neutral-900 hover:underline"
                >
                  {listing.title}
                </Link>
                <p className="text-sm text-neutral-600">
                  {listing.city}, {listing.state} ·{" "}
                  {formatUsdFromCents(listing.rentCents)} ·{" "}
                  {listing.published ? "Published" : "Draft"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
