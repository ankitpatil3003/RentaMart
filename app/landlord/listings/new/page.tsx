"use client";

import { useSearchParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { ListingEditor } from "@/components/landlord/ListingEditor";

export default function NewListingPage() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId") as Id<"orgs"> | null;

  if (!orgId) {
    return <p className="text-neutral-600">Select an organization.</p>;
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
        New listing draft
      </h2>
      <p className="mt-2 text-neutral-600">
        Save a draft first. Publish after Connect is ready.
      </p>
      <ListingEditor orgId={orgId} />
    </div>
  );
}
