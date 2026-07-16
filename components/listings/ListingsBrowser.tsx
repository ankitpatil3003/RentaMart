"use client";

import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ListingCard } from "@/components/listings/ListingCard";
import { ListingFilters } from "@/components/listings/ListingFilters";
import { SearchAssist } from "@/components/ai/SearchAssist";
import { SiteHeader } from "@/components/SiteHeader";

export function ListingsBrowser() {
  const [city, setCity] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [minBeds, setMinBeds] = useState("");
  const ai = useQuery(api.ai.isEnabled);

  const maxRentCents = useMemo(() => {
    if (!maxRent.trim()) return undefined;
    const n = Number(maxRent);
    return Number.isFinite(n) ? Math.floor(n * 100) : undefined;
  }, [maxRent]);

  const minBedsNumber = useMemo(() => {
    if (!minBeds.trim()) return undefined;
    const n = Number(minBeds);
    return Number.isFinite(n) ? Math.floor(n) : undefined;
  }, [minBeds]);

  const { results, status, loadMore } = usePaginatedQuery(
    api.listings.search,
    {
      city: city.trim() || undefined,
      maxRentCents,
      minBeds: minBedsNumber,
    },
    { initialNumItems: 20 },
  );

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f5f1_0%,#ffffff_40%)]">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">
          Listings
        </h1>
        <p className="mt-2 text-neutral-600">
          List-first search with plain filters. Map comes later.
        </p>
        <ListingFilters
          city={city}
          maxRent={maxRent}
          minBeds={minBeds}
          onCityChange={setCity}
          onMaxRentChange={setMaxRent}
          onMinBedsChange={setMinBeds}
        />
        {ai?.enabled ? (
          <SearchAssist
            onApply={(filters) => {
              if (filters.city) setCity(filters.city);
              if (filters.maxRentCents !== undefined) {
                setMaxRent(String(Math.round(filters.maxRentCents / 100)));
              }
              if (filters.minBeds !== undefined) {
                setMinBeds(String(filters.minBeds));
              }
            }}
          />
        ) : null}
        <section className="mt-10">
          {results.length === 0 && status !== "LoadingFirstPage" ? (
            <p className="text-neutral-600">No listings yet.</p>
          ) : (
            results.map((listing) => (
              <ListingCard
                key={listing._id}
                id={listing._id}
                title={listing.title}
                city={listing.city}
                state={listing.state}
                rentCents={listing.rentCents}
                beds={listing.beds}
                baths={listing.baths}
                photoUrls={listing.photoUrls}
              />
            ))
          )}
          {status === "CanLoadMore" ? (
            <button
              type="button"
              onClick={() => loadMore(20)}
              className="mt-6 border border-neutral-900 px-4 py-2 text-sm"
            >
              Load more
            </button>
          ) : null}
        </section>
      </div>
    </main>
  );
}
