"use client";

import { use } from "react";
import { ApplicationStatusView } from "@/components/applications/ApplicationStatus";
import type { Id } from "@/convex/_generated/dataModel";

export default function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ApplicationStatusView applicationId={id as Id<"applications">} />;
}
