"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useTransition } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  formatRelativeTime,
  notificationTypeLabel,
} from "@/lib/format";
import { withOrgId } from "@/lib/landlord/paths";

export function NotificationList({
  orgId,
}: {
  orgId?: Id<"orgs">;
}) {
  const mine = useQuery(
    api.notifications.listMine,
    orgId ? "skip" : {},
  );
  const forOrg = useQuery(
    api.notifications.listForOrg,
    orgId ? { orgId } : "skip",
  );
  const notifications = orgId ? forOrg : mine;
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const [isPending, startTransition] = useTransition();

  const unreadCount =
    notifications?.filter((n) => n.readAt === undefined).length ?? 0;

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllRead({ orgId });
    });
  }

  function handleMarkRead(notificationId: Id<"notifications">) {
    startTransition(async () => {
      await markRead({ notificationId });
    });
  }

  if (notifications === undefined) {
    return <p className="text-neutral-600">Loading notifications…</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-neutral-600">
          {unreadCount > 0
            ? `${unreadCount} unread`
            : "All caught up"}
        </p>
        {unreadCount > 0 ? (
          <button
            type="button"
            disabled={isPending}
            onClick={handleMarkAllRead}
            className="text-sm text-neutral-700 underline disabled:opacity-50"
          >
            Mark all read
          </button>
        ) : null}
      </div>

      {notifications.length === 0 ? (
        <p className="mt-8 rounded-md border border-neutral-200 bg-white p-6 text-neutral-600">
          No notifications yet. Updates about your applications will appear
          here.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
          {notifications.map((notification) => {
            const applicationHref = orgId
              ? withOrgId(
                  `/landlord/applications/${notification.applicationId}`,
                  orgId,
                )
              : `/applications/${notification.applicationId}`;
            const isUnread = notification.readAt === undefined;

            return (
              <li
                key={notification._id}
                className={`px-5 py-4 ${isUnread ? "bg-amber-50/50" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-neutral-900">
                      {notification.title}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {notificationTypeLabel(notification.type)}
                      {notification.listingTitle
                        ? ` · ${notification.listingTitle}`
                        : ""}{" "}
                      · {formatRelativeTime(notification.createdAt)}
                    </p>
                  </div>
                  {isUnread ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleMarkRead(notification._id)}
                      className="text-xs text-neutral-600 underline disabled:opacity-50"
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-neutral-700">
                  {notification.body}
                </p>
                <Link
                  href={applicationHref}
                  className="mt-3 inline-block text-sm text-neutral-900 underline"
                >
                  View application
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
