"use client";

import { Suspense, use } from "react";
import { ApplicationStatusView } from "@/components/applications/ApplicationStatus";
import type { Id } from "@/convex/_generated/dataModel";

function ApplicationPageInner({ id }: { id: Id<"applications"> }) {
  return <ApplicationStatusView applicationId={id} />;
}

export default function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense fallback={<p className="px-6 py-12 text-neutral-600">Loading…</p>}>
      <ApplicationPageInner id={id as Id<"applications">} />
    </Suspense>
  );
}
