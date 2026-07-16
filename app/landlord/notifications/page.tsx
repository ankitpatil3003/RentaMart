"use client";

import { useSearchParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { NotificationList } from "@/components/notifications/NotificationList";

export default function LandlordNotificationsPage() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId") as Id<"orgs"> | null;

  if (!orgId) {
    return <p className="text-neutral-600">Select an organization.</p>;
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Notifications
      </h2>
      <p className="mt-2 text-neutral-600">
        Application updates for your organization.
      </p>
      <div className="mt-8">
        <NotificationList orgId={orgId} />
      </div>
    </div>
  );
}
