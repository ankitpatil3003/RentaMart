"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";

function formatWhen(timestamp?: number): string {
  if (!timestamp) return "No messages yet";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export default function LandlordMessagesPage() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId") as Id<"orgs"> | null;
  const threads = useQuery(
    api.messages.listThreadsForOrg,
    orgId ? { orgId } : "skip",
  );

  if (!orgId) {
    return <p className="text-neutral-600">Select an organization.</p>;
  }

  if (threads === undefined) {
    return <p className="text-neutral-600">Loading messages…</p>;
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Messages
      </h2>
      <p className="mt-2 text-neutral-600">
        Conversations with renters about applications.
      </p>
      {threads.length === 0 ? (
        <p className="mt-8 text-neutral-600">No conversations yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-neutral-200">
          {threads.map((thread) => (
            <li key={thread._id} className="py-4">
              <Link
                href={`/messages/${thread.applicationId}`}
                className="text-lg text-neutral-900 hover:underline"
              >
                {thread.renterName} · {thread.listingTitle}
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
      )}
    </div>
  );
}
