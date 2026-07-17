"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { FormEvent, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SiteHeader } from "@/components/SiteHeader";

function formatWhen(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function MessageThread({
  applicationId,
}: {
  applicationId: Id<"applications">;
}) {
  const router = useRouter();
  const thread = useQuery(api.messages.listMessages, { applicationId });
  const send = useMutation(api.messages.send);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!thread) return;
    if (thread.access === "forbidden" || thread.access === "not_found") {
      router.replace("/messages");
    }
  }, [thread, router]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await send({ applicationId, body });
        setBody("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send message");
      }
    });
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f5f1_0%,#ffffff_40%)]">
      <SiteHeader />
      <div className="mx-auto flex max-w-3xl flex-col px-6 py-12">
        <Link href="/messages" className="text-sm text-neutral-600 hover:underline">
          Back to messages
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Conversation</h1>

        {thread === undefined ? (
          <p className="mt-8 text-neutral-600">Loading…</p>
        ) : thread.access !== "ok" ? (
          <p className="mt-8 text-neutral-600">Redirecting…</p>
        ) : (
          <>
            <div className="mt-8 flex-1 space-y-4 rounded-md border border-neutral-200 bg-white p-5">
              {thread.messages.length === 0 ? (
                <p className="text-neutral-600">No messages yet. Say hello.</p>
              ) : (
                thread.messages.map((message) => (
                  <div
                    key={message._id}
                    className={
                      message.isMine ? "text-right" : "text-left"
                    }
                  >
                    <p className="text-xs text-neutral-500">
                      {message.senderName} · {formatWhen(message.createdAt)}
                    </p>
                    <p
                      className={
                        message.isMine
                          ? "mt-1 inline-block rounded-md bg-neutral-900 px-3 py-2 text-sm text-white"
                          : "mt-1 inline-block rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-900"
                      }
                    >
                      {message.body}
                    </p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={onSubmit} className="mt-6 grid gap-3">
              <label className="text-sm text-neutral-600">
                Message
                <textarea
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
                />
              </label>
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
              <button
                type="submit"
                disabled={isPending}
                className="w-fit rounded-md bg-neutral-900 px-5 py-3 text-white disabled:opacity-50"
              >
                {isPending ? "Sending…" : "Send"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
