"use client";

import { useMutation } from "convex/react";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function ApplyForm({ listingId }: { listingId: Id<"listings"> }) {
  const createDraft = useMutation(api.applications.createDraft);
  const submit = useMutation(api.applications.submit);
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const applicationId = await createDraft({
          listingId,
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          message: message.trim() || undefined,
        });
        await submit({ applicationId });
        router.push(`/applications/${applicationId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not submit");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid max-w-md gap-4">
      <label className="block text-sm text-neutral-600">
        Full name
        <input
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
        />
      </label>
      <label className="block text-sm text-neutral-600">
        Email
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
        />
      </label>
      <label className="block text-sm text-neutral-600">
        Phone
        <input
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
        />
      </label>
      <label className="block text-sm text-neutral-600">
        Message (optional)
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-neutral-900 px-5 py-3 text-white disabled:opacity-50"
      >
        {isPending ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}
