"use client";

import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { statusLabel } from "@/lib/format";
import { SiteHeader } from "@/components/SiteHeader";

function formatSubmittedAt(timestamp?: number): string {
  if (!timestamp) return "Not submitted yet";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function MyApplicationsList() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const profileReady = isAuthenticated && me !== undefined && me !== null;
  const applications = useQuery(
    api.applications.listMine,
    profileReady ? {} : "skip",
  );
  const unreadNotifications = useQuery(
    api.notifications.unreadCount,
    profileReady ? {} : "skip",
  );

  if (authLoading || (isAuthenticated && me === undefined)) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <p className="px-6 py-12 text-neutral-600">Loading…</p>
      </main>
    );
  }

  if (!isAuthenticated || me === null) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-3xl px-6 py-12">
          <h1 className="text-4xl font-semibold tracking-tight">
            My applications
          </h1>
          <p className="mt-4 text-neutral-600">
            Sign in to track your rental applications and payments.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f5f1_0%,#ffffff_40%)]">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">
          My applications
        </h1>
        <p className="mt-2 text-neutral-600">
          Track status and complete any payments for your applications.
        </p>
        {unreadNotifications !== undefined && unreadNotifications > 0 ? (
          <p className="mt-4 text-sm text-amber-900">
            You have {unreadNotifications} unread notification
            {unreadNotifications === 1 ? "" : "s"}.{" "}
            <Link href="/notifications" className="underline">
              View notifications
            </Link>
          </p>
        ) : null}

        {applications === undefined ? (
          <p className="mt-8 text-neutral-600">Loading applications…</p>
        ) : applications.length === 0 ? (
          <div className="mt-8 rounded-md border border-neutral-200 bg-white p-6">
            <p className="text-neutral-600">You have not applied to any listings yet.</p>
            <Link
              href="/listings"
              className="mt-4 inline-block text-neutral-900 underline"
            >
              Browse listings
            </Link>
          </div>
        ) : (
          <ul className="mt-8 divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
            {applications.map((application) => (
              <li key={application._id} className="px-5 py-4">
                <Link
                  href={`/applications/${application._id}`}
                  className="text-lg font-medium text-neutral-900 hover:underline"
                >
                  {application.listingTitle}
                </Link>
                <p className="mt-1 text-sm text-neutral-600">
                  {application.listingCity}, {application.listingState}
                </p>
                <p className="mt-2 text-sm text-neutral-900">
                  Status: {statusLabel(application.status)}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {formatSubmittedAt(application.submittedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
