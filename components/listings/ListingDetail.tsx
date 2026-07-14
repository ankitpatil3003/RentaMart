"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatUsdFromCents } from "@/lib/format";
import { SiteHeader } from "@/components/SiteHeader";
import { ListingQa } from "@/components/listings/ListingQa";
import { ApplyForm } from "@/components/applications/ApplyForm";
import { Show, SignInButton } from "@clerk/nextjs";

export function ListingDetail({ listingId }: { listingId: Id<"listings"> }) {
  const listing = useQuery(api.listings.getById, { listingId });
  const ai = useQuery(api.ai.isEnabled);

  if (listing === undefined) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <p className="px-6 py-12 text-neutral-600">Loading…</p>
      </main>
    );
  }

  if (listing === null) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <p className="px-6 py-12 text-neutral-600">Listing not found.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f5f1_0%,#ffffff_45%)]">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <div className="aspect-[16/9] overflow-hidden bg-neutral-100">
          {listing.photoUrls[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.photoUrls[0]}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <h1 className="mt-8 text-4xl font-semibold tracking-tight">
          {listing.title}
        </h1>
        <p className="mt-2 text-neutral-600">
          {listing.city}, {listing.state} {listing.zip}
        </p>
        <p className="mt-4 text-2xl text-neutral-900">
          {formatUsdFromCents(listing.rentCents)}
          <span className="text-base text-neutral-500"> / month</span>
        </p>
        <p className="mt-2 text-neutral-600">
          {listing.beds} bed · {listing.baths} bath · Application fee{" "}
          {formatUsdFromCents(listing.applicationFeeCents)}
        </p>
        <p className="mt-6 max-w-2xl leading-relaxed text-neutral-700">
          {listing.description}
        </p>

        <section className="mt-12 border-t border-neutral-200 pt-8">
          <h2 className="text-2xl font-semibold tracking-tight">Apply</h2>
          <Show when="signed-out">
            <p className="mt-3 text-neutral-600">Sign in to apply for this home.</p>
            <SignInButton mode="modal">
              <button
                type="button"
                className="mt-4 rounded-md bg-neutral-900 px-5 py-3 text-white"
              >
                Sign in to apply
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <ApplyForm listingId={listingId} />
          </Show>
        </section>

        {ai?.enabled ? <ListingQa listingId={listingId} /> : null}
      </article>
    </main>
  );
}
