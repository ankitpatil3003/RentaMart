"use client";

import Link from "next/link";
import { FormEvent, useRef, useState, useTransition } from "react";
import { useMutation, useQuery } from "convex/react";
import { Show } from "@clerk/nextjs";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { SiteHeader } from "@/components/SiteHeader";
import { withOrgId } from "@/lib/landlord/paths";

function BecomeLandlordForm() {
  const request = useQuery(api.landlordRequests.getMine);
  const orgs = useQuery(api.orgs.listMine);
  const generateUploadUrl = useMutation(api.landlordRequests.generateUploadUrl);
  const submit = useMutation(api.landlordRequests.submit);
  const [orgName, setOrgName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  if (request === undefined || orgs === undefined) {
    return <p className="mt-8 text-neutral-600">Loading…</p>;
  }

  if (orgs.length > 0) {
    return (
      <div className="mt-8">
        <p className="text-neutral-600">
          You already have landlord access.
        </p>
        <Link
          href={withOrgId("/landlord", orgs[0]!._id)}
          className="mt-4 inline-block underline"
        >
          Open landlord portal
        </Link>
      </div>
    );
  }

  if (request?.status === "pending") {
    return (
      <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
        <p className="font-medium">Request pending review</p>
        <p className="mt-2">
          Organization: {request.orgName}. Our team is verifying your documents.
          You will gain landlord access after approval.
        </p>
      </div>
    );
  }

  if (request?.status === "approved" && request.createdOrgId) {
    return (
      <div className="mt-8">
        <p className="text-neutral-600">Your landlord request was approved.</p>
        <Link
          href={withOrgId("/landlord", request.createdOrgId)}
          className="mt-4 inline-block underline"
        >
          Open landlord portal
        </Link>
      </div>
    );
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        if (!files || files.length < 1) {
          throw new Error("Upload at least one verification document");
        }
        const documentStorageIds: Array<Id<"_storage">> = [];
        for (const file of Array.from(files)) {
          const uploadUrl = await generateUploadUrl({});
          const result = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": file.type || "application/octet-stream" },
            body: file,
          });
          if (!result.ok) {
            throw new Error(`Failed to upload ${file.name}`);
          }
          const { storageId } = (await result.json()) as {
            storageId: Id<"_storage">;
          };
          documentStorageIds.push(storageId);
        }
        await submit({
          orgName: orgName.trim(),
          contactPhone: contactPhone.trim() || undefined,
          notes: notes.trim() || undefined,
          documentStorageIds,
        });
        if (fileRef.current) fileRef.current.value = "";
        setFiles(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not submit request",
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 grid max-w-md gap-4">
      {request?.status === "denied" ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-medium">Previous request denied</p>
          {request.adminNote ? (
            <p className="mt-1">{request.adminNote}</p>
          ) : null}
          <p className="mt-2">You may submit a new request below.</p>
        </div>
      ) : null}
      <label className="block text-sm text-neutral-600">
        Organization / business name
        <input
          required
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
        />
      </label>
      <label className="block text-sm text-neutral-600">
        Contact phone
        <input
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
        />
      </label>
      <label className="block text-sm text-neutral-600">
        Notes for reviewers
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Property ownership details, management company info, etc."
          className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
        />
      </label>
      <label className="block text-sm text-neutral-600">
        Verification documents
        <input
          ref={fileRef}
          required
          type="file"
          multiple
          accept="image/*,.pdf"
          onChange={(e) => setFiles(e.target.files)}
          className="mt-1 block w-full text-sm"
        />
        <span className="mt-1 block text-xs text-neutral-500">
          Deed, title, property management agreement, or government ID for the
          listing entity.
        </span>
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-neutral-900 px-5 py-3 text-white disabled:opacity-50"
      >
        {isPending ? "Submitting…" : "Request landlord access"}
      </button>
    </form>
  );
}

export default function BecomeLandlordPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f5f1_0%,#ffffff_40%)]">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">
          Become a landlord
        </h1>
        <p className="mt-2 text-neutral-600">
          Submit your organization details and ownership or authorization
          documents. RentaMart reviews each request before granting portal
          access.
        </p>
        <Show when="signed-in">
          <BecomeLandlordForm />
        </Show>
        <Show when="signed-out">
          <p className="mt-8 text-neutral-600">
            Sign in to request landlord access.{" "}
            <Link href="/sign-in" className="underline">
              Sign in
            </Link>
          </p>
        </Show>
      </div>
    </main>
  );
}
