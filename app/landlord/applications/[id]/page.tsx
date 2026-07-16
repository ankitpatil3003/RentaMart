"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { ApplicationReview } from "@/components/landlord/ApplicationReview";

export default function LandlordApplicationDetailPage({
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
        Application review
      </h2>
      <p className="mt-2 text-neutral-600">
        Review applicants, select the best qualified tenant, process refunds for
        non-selected applicants, and confirm move-in.
      </p>
      <ApplicationReview
        orgId={orgId}
        applicationId={id as Id<"applications">}
      />
    </div>
  );
}
