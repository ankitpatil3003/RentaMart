"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Show } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SiteHeader } from "@/components/SiteHeader";
import { withOrgId } from "@/lib/landlord/paths";

function formatWhen(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function InvitesPanel() {
  const router = useRouter();
  const invites = useQuery(api.orgInvites.listPendingForMe);
  const accept = useMutation(api.orgInvites.accept);
  const decline = useMutation(api.orgInvites.decline);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (invites === undefined) {
    return <p className="mt-8 text-neutral-600">Loading invites…</p>;
  }

  if (invites.length === 0) {
    return (
      <p className="mt-8 text-neutral-600">
        No pending organization invites.{" "}
        <Link href="/become-landlord" className="underline">
          Request landlord access
        </Link>{" "}
        if you need your own organization.
      </p>
    );
  }

  function run(
    inviteId: Id<"orgInvites">,
    action: "accept" | "decline",
  ) {
    setError(null);
    startTransition(async () => {
      try {
        if (action === "accept") {
          const orgId = await accept({ inviteId });
          router.push(withOrgId("/landlord", orgId));
        } else {
          await decline({ inviteId });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <div className="mt-8 grid gap-4">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {invites.map((invite) => (
        <article
          key={invite._id}
          className="border border-neutral-200 bg-white px-4 py-4"
        >
          <h2 className="text-lg font-medium text-neutral-900">
            {invite.orgName}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Invited by {invite.invitedByEmail} · {formatWhen(invite.createdAt)}
          </p>
          <p className="mt-2 text-sm text-neutral-700">
            Role: leasing agent
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(invite._id, "accept")}
              className="rounded-md bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
            >
              Accept
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(invite._id, "decline")}
              className="border border-neutral-900 px-4 py-2 text-neutral-900 disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function InvitesPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f5f1_0%,#ffffff_40%)]">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">
          Organization invites
        </h1>
        <p className="mt-2 text-neutral-600">
          Accept an invite to join an organization as a leasing agent.
        </p>
        <Show when="signed-in">
          <InvitesPanel />
        </Show>
        <Show when="signed-out">
          <p className="mt-8 text-neutral-600">
            Sign in to view invites.{" "}
            <Link href="/sign-in" className="underline">
              Sign in
            </Link>
          </p>
        </Show>
      </div>
    </main>
  );
}
