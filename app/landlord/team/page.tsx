"use client";

import { FormEvent, useState, useTransition } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { landlordApi } from "@/lib/landlord/api";

function formatWhen(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export default function LandlordTeamPage() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId") as Id<"orgs"> | null;
  const orgs = useQuery(landlordApi.orgs.listMine);
  const members = useQuery(
    api.orgInvites.listMembers,
    orgId ? { orgId } : "skip",
  );
  const invites = useQuery(
    api.orgInvites.listForOrg,
    orgId ? { orgId } : "skip",
  );
  const createInvite = useMutation(api.orgInvites.create);
  const cancelInvite = useMutation(api.orgInvites.cancel);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const role = orgId
    ? orgs?.find((row) => row._id === orgId)?.role
    : undefined;
  const isOwner = role === "org_owner";

  if (!orgId) {
    return <p className="text-neutral-600">Select an organization.</p>;
  }

  if (orgs === undefined || members === undefined) {
    return <p className="text-neutral-600">Loading team…</p>;
  }

  if (!isOwner) {
    return (
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Team
        </h2>
        <p className="mt-2 text-neutral-600">
          Only the organization owner can invite leasing agents.
        </p>
        <ul className="mt-6 divide-y divide-neutral-200 border border-neutral-200 bg-white">
          {members.map((member) => (
            <li key={member._id} className="px-4 py-3 text-sm">
              <p className="font-medium text-neutral-900">
                {member.name ?? member.email}
              </p>
              <p className="text-neutral-600">
                {member.email} · {member.role.replace("_", " ")}
              </p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function onInvite(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await createInvite({ orgId: orgId!, email: email.trim() });
        setEmail("");
        setSuccess("Invite sent. They must accept from Invites.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send invite");
      }
    });
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Team
      </h2>
      <p className="mt-2 text-neutral-600">
        Invite verified landlords as leasing agents. They must accept before
        joining.
      </p>

      <form onSubmit={onInvite} className="mt-8 grid max-w-md gap-3">
        <label className="block text-sm text-neutral-600">
          Agent email (must already have a RentaMart account)
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {success ? <p className="text-sm text-green-800">{success}</p> : null}
        <button
          type="submit"
          disabled={isPending}
          className="w-fit rounded-md bg-neutral-900 px-5 py-3 text-white disabled:opacity-50"
        >
          {isPending ? "Sending…" : "Send invite"}
        </button>
      </form>

      <section className="mt-10">
        <h3 className="text-lg font-medium text-neutral-900">Members</h3>
        <ul className="mt-4 divide-y divide-neutral-200 border border-neutral-200 bg-white">
          {members.map((member) => (
            <li key={member._id} className="px-4 py-3 text-sm">
              <p className="font-medium text-neutral-900">
                {member.name ?? member.email}
              </p>
              <p className="text-neutral-600">
                {member.email} · {member.role.replace("_", " ")}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h3 className="text-lg font-medium text-neutral-900">Invites</h3>
        {invites === undefined ? (
          <p className="mt-4 text-neutral-600">Loading invites…</p>
        ) : invites.length === 0 ? (
          <p className="mt-4 text-neutral-600">No invites yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-200 border border-neutral-200 bg-white">
            {invites.map((invite) => (
              <li
                key={invite._id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-neutral-900">{invite.email}</p>
                  <p className="text-neutral-600">
                    {invite.status} · {formatWhen(invite.createdAt)}
                  </p>
                </div>
                {invite.status === "pending" ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setError(null);
                      startTransition(async () => {
                        try {
                          await cancelInvite({
                            orgId,
                            inviteId: invite._id,
                          });
                        } catch (err) {
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Could not cancel invite",
                          );
                        }
                      });
                    }}
                    className="border border-neutral-900 px-3 py-1.5 text-neutral-900 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
