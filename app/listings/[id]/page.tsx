"use client";

import { use } from "react";
import { ListingDetail } from "@/components/listings/ListingDetail";
import type { Id } from "@/convex/_generated/dataModel";

export default function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ListingDetail listingId={id as Id<"listings">} />;
}
