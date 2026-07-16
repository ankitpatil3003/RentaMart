"use client";

import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type ToastItem = {
  id: Id<"notifications">;
  title: string;
  body: string;
  href: string;
};

export function NotificationToasts() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const notifications = useQuery(
    api.notifications.listMine,
    isAuthenticated ? {} : "skip",
  );
  const [toast, setToast] = useState<ToastItem | null>(null);
  const hydrated = useRef(false);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    if (!isAuthenticated || notifications === undefined) return;

    if (!hydrated.current) {
      for (const notification of notifications) {
        seenIds.current.add(notification._id);
      }
      hydrated.current = true;
      return;
    }

    for (const notification of notifications) {
      if (seenIds.current.has(notification._id)) continue;
      seenIds.current.add(notification._id);
      if (notification.readAt !== undefined) continue;

      const href = notification.orgId
        ? `/landlord/notifications?orgId=${notification.orgId}`
        : "/notifications";
      setToast({
        id: notification._id,
        title: notification.title,
        body: notification.body,
        href,
      });
      break;
    }
  }, [isAuthenticated, notifications]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (isLoading || !toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 max-w-sm border border-neutral-300 bg-white p-4 shadow-lg"
    >
      <p className="text-sm font-medium text-neutral-900">{toast.title}</p>
      <p className="mt-1 text-sm text-neutral-600 line-clamp-2">{toast.body}</p>
      <div className="mt-3 flex items-center gap-4 text-sm">
        <Link href={toast.href} className="text-neutral-900 underline">
          View
        </Link>
        <button
          type="button"
          onClick={() => setToast(null)}
          className="text-neutral-600 underline"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
