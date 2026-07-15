"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteHeader } from "@/components/SiteHeader";
import { statusLabel } from "@/lib/format";

function formatWhen(timestamp?: number): string {
  if (!timestamp) return "No messages yet";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function MessageThreadList() {
  const threads = useQuery(api.messages.listThreadsForRenter);
  const applications = useQuery(api.applications.listMine);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f5f1_0%,#ffffff_40%)]">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-2 text-neutral-600">
          Chat with landlords about your applications.
        </p>

        {threads === undefined || applications === undefined ? (
          <p className="mt-8 text-neutral-600">Loading…</p>
        ) : (
          <>
            {threads.length > 0 ? (
              <ul className="mt-8 divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
                {threads.map((thread) => (
                  <li key={thread._id} className="px-5 py-4">
                    <Link
                      href={`/messages/${thread.applicationId}`}
                      className="text-lg font-medium text-neutral-900 hover:underline"
                    >
                      {thread.listingTitle}
                    </Link>
                    {thread.preview ? (
                      <p className="mt-1 truncate text-sm text-neutral-600">
                        {thread.preview}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-neutral-500">
                      {formatWhen(thread.lastMessageAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}

            <section className="mt-8">
              <h2 className="text-lg font-medium text-neutral-900">
                Start a conversation
              </h2>
              {applications.length === 0 ? (
                <p className="mt-2 text-neutral-600">
                  Apply to a listing first to message a landlord.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
                  {applications.map((application) => (
                    <li key={application._id} className="px-5 py-4">
                      <Link
                        href={`/messages/${application._id}`}
                        className="text-neutral-900 hover:underline"
                      >
                        {application.listingTitle}
                      </Link>
                      <p className="mt-1 text-sm text-neutral-600">
                        {statusLabel(application.status)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
