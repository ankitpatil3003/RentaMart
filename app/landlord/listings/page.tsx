"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { formatUsdFromCents } from "@/lib/format";
import { landlordApi } from "@/lib/landlord/api";
import { withOrgId } from "@/lib/landlord/paths";

export default function LandlordListingsPage() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId") as Id<"orgs"> | null;
  const listings = useQuery(
    landlordApi.listings.listForOrg,
    orgId ? { orgId } : "skip",
  );

  if (!orgId) {
    return <p className="text-neutral-600">Select an organization.</p>;
  }

  if (listings === undefined) {
    return <p className="text-neutral-600">Loading listings…</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Listings
          </h2>
          <p className="mt-2 text-neutral-600">
            Draft, submit for authenticity review, then publish when Connect is
            ready.
          </p>
        </div>
        <Link
          href={withOrgId("/landlord/listings/new", orgId)}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white"
        >
          New draft
        </Link>
      </div>
      <section className="mt-8">
        {listings.length === 0 ? (
          <p className="text-neutral-600">No listings yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {listings.map((listing) => (
              <li key={listing._id} className="py-4">
                <Link
                  href={withOrgId(
                    `/landlord/listings/${listing._id}/edit`,
                    orgId,
                  )}
                  className="text-lg text-neutral-900 hover:underline"
                >
                  {listing.title}
                </Link>
                <p className="mt-1 text-sm text-neutral-600">
                  {listing.city}, {listing.state} ·{" "}
                  {formatUsdFromCents(listing.rentCents)} ·{" "}
                  {listing.published
                    ? "Published"
                    : listing.verificationStatus === "pending_review"
                      ? "Pending review"
                      : listing.verificationStatus === "approved"
                        ? "Approved (unpublished)"
                        : listing.verificationStatus === "denied"
                          ? "Denied"
                          : "Draft"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
