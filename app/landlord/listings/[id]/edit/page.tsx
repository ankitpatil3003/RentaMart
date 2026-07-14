"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { ListingEditor } from "@/components/landlord/ListingEditor";

export default function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId") as Id<"orgs"> | null;

  if (!orgId) {
    return <p className="text-neutral-600">Select an organization.</p>;
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Edit listing
      </h2>
      <p className="mt-2 text-neutral-600">
        Update details, then publish or unpublish.
      </p>
      <ListingEditor orgId={orgId} listingId={id as Id<"listings">} />
    </div>
  );
}
