"use client";

import { useMutation, useQuery } from "convex/react";
import {
  FormEvent,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { landlordApi, type LandlordListing } from "@/lib/landlord/api";
import { withOrgId } from "@/lib/landlord/paths";

type ListingEditorProps = {
  orgId: Id<"orgs">;
  listingId?: Id<"listings">;
};

type FormState = {
  title: string;
  description: string;
  city: string;
  state: string;
  zip: string;
  rent: string;
  deposit: string;
  firstMonth: string;
  beds: string;
  baths: string;
  photoUrls: string;
  applicationFee: string;
};

const emptyForm: FormState = {
  title: "",
  description: "",
  city: "",
  state: "",
  zip: "",
  rent: "",
  deposit: "",
  firstMonth: "",
  beds: "1",
  baths: "1",
  photoUrls: "",
  applicationFee: "50",
};

function formFromListing(listing: LandlordListing): FormState {
  return {
    title: listing.title,
    description: listing.description,
    city: listing.city,
    state: listing.state,
    zip: listing.zip,
    rent: String(listing.rentCents / 100),
    deposit: String(listing.depositCents / 100),
    firstMonth: String(listing.firstMonthCents / 100),
    beds: String(listing.beds),
    baths: String(listing.baths),
    photoUrls: listing.photoUrls.join("\n"),
    applicationFee: String(listing.applicationFeeCents / 100),
  };
}

function dollarsToCents(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Enter a valid dollar amount");
  }
  return Math.round(n * 100);
}

function parsePhotoUrls(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function ListingEditorForm({
  orgId,
  listingId,
  initialForm,
  published,
  connectReady,
  verificationStatus,
  verificationNote,
}: {
  orgId: Id<"orgs">;
  listingId?: Id<"listings">;
  initialForm: FormState;
  published: boolean;
  connectReady: boolean;
  verificationStatus: "draft" | "pending_review" | "approved" | "denied";
  verificationNote?: string;
}) {
  const router = useRouter();
  const createDraft = useMutation(landlordApi.listings.createDraft);
  const update = useMutation(landlordApi.listings.update);
  const publish = useMutation(landlordApi.listings.publish);
  const unpublish = useMutation(landlordApi.listings.unpublish);
  const submitForVerification = useMutation(
    landlordApi.listings.submitForVerification,
  );
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function field(key: keyof FormState) {
    return {
      value: form[key],
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((prev) => ({ ...prev, [key]: e.target.value })),
    };
  }

  function buildPayload() {
    const rentCents = dollarsToCents(form.rent);
    const depositCents = form.deposit.trim()
      ? dollarsToCents(form.deposit)
      : rentCents;
    const firstMonthCents = form.firstMonth.trim()
      ? dollarsToCents(form.firstMonth)
      : rentCents;
    return {
      title: form.title.trim(),
      description: form.description.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      zip: form.zip.trim(),
      rentCents,
      depositCents,
      firstMonthCents,
      beds: Math.floor(Number(form.beds)),
      baths: Number(form.baths),
      photoUrls: parsePhotoUrls(form.photoUrls),
      applicationFeeCents: dollarsToCents(form.applicationFee),
    };
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const payload = buildPayload();
        if (listingId) {
          await update({ orgId, listingId, ...payload });
        } else {
          const id = await createDraft({ orgId, ...payload });
          router.push(withOrgId(`/landlord/listings/${id}/edit`, orgId));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save listing");
      }
    });
  }

  const statusLabel =
    verificationStatus === "pending_review"
      ? "Pending platform authenticity review"
      : verificationStatus === "approved"
        ? "Approved for publish"
        : verificationStatus === "denied"
          ? "Denied by platform review"
          : "Draft";

  return (
    <form onSubmit={onSubmit} className="mt-8 grid max-w-lg gap-4">
      {listingId ? (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
          Verification: {statusLabel}
          {verificationNote ? (
            <span className="mt-1 block text-neutral-600">{verificationNote}</span>
          ) : null}
        </div>
      ) : null}
      <label className="block text-sm text-neutral-600">
        Title
        <input
          required
          {...field("title")}
          className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
        />
      </label>
      <label className="block text-sm text-neutral-600">
        Description
        <textarea
          required
          rows={4}
          {...field("description")}
          className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm text-neutral-600">
          City
          <input
            required
            {...field("city")}
            className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
          />
        </label>
        <label className="block text-sm text-neutral-600">
          State
          <input
            required
            {...field("state")}
            className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
          />
        </label>
        <label className="block text-sm text-neutral-600">
          ZIP
          <input
            required
            {...field("zip")}
            className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-neutral-600">
          Monthly rent (USD)
          <input
            required
            inputMode="decimal"
            {...field("rent")}
            className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
          />
        </label>
        <label className="block text-sm text-neutral-600">
          Application fee (USD)
          <input
            required
            inputMode="decimal"
            {...field("applicationFee")}
            className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
          />
        </label>
        <label className="block text-sm text-neutral-600">
          Deposit (USD)
          <input
            inputMode="decimal"
            {...field("deposit")}
            placeholder="Defaults to rent"
            className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
          />
        </label>
        <label className="block text-sm text-neutral-600">
          First month (USD)
          <input
            inputMode="decimal"
            {...field("firstMonth")}
            placeholder="Defaults to rent"
            className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
          />
        </label>
        <label className="block text-sm text-neutral-600">
          Beds
          <input
            required
            inputMode="numeric"
            {...field("beds")}
            className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
          />
        </label>
        <label className="block text-sm text-neutral-600">
          Baths
          <input
            required
            inputMode="decimal"
            {...field("baths")}
            className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
          />
        </label>
      </div>
      <label className="block text-sm text-neutral-600">
        Photo URLs (one per line)
        <textarea
          rows={3}
          {...field("photoUrls")}
          className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-neutral-900 px-5 py-3 text-white disabled:opacity-50"
      >
        {isPending ? "Saving…" : listingId ? "Save changes" : "Create draft"}
      </button>
      {listingId ? (
        <div className="border-t border-neutral-200 pt-6">
          <p className="text-sm text-neutral-600">
            {published
              ? "This listing is published."
              : "This listing is not published."}
          </p>
          {!connectReady && !published ? (
            <p className="mt-2 text-sm text-amber-800">
              Complete Stripe Connect onboarding before publishing.
            </p>
          ) : null}
          {verificationStatus !== "approved" && !published ? (
            <p className="mt-2 text-sm text-amber-800">
              Submit for authenticity review. Publish is enabled only after
              platform approval and Connect readiness.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            {verificationStatus === "draft" ||
            verificationStatus === "denied" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    try {
                      await submitForVerification({ orgId, listingId });
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Could not submit for review",
                      );
                    }
                  });
                }}
                className="border border-neutral-900 px-5 py-3 text-neutral-900 disabled:opacity-50"
              >
                Submit for review
              </button>
            ) : null}
            {verificationStatus === "pending_review" ? (
              <p className="text-sm text-neutral-600">
                Waiting for platform authenticity review…
              </p>
            ) : null}
            {!published ? (
              <button
                type="button"
                disabled={
                  isPending ||
                  !connectReady ||
                  verificationStatus !== "approved"
                }
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    try {
                      await publish({ orgId, listingId });
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Could not publish",
                      );
                    }
                  });
                }}
                className="rounded-md bg-neutral-900 px-5 py-3 text-white disabled:opacity-50"
              >
                Publish
              </button>
            ) : (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    try {
                      await unpublish({ orgId, listingId });
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Could not unpublish",
                      );
                    }
                  });
                }}
                className="border border-neutral-900 px-5 py-3 text-neutral-900 disabled:opacity-50"
              >
                Unpublish
              </button>
            )}
          </div>
        </div>
      ) : null}
    </form>
  );
}

export function ListingEditor({ orgId, listingId }: ListingEditorProps) {
  const existing = useQuery(
    landlordApi.listings.getForOrgEdit,
    listingId ? { orgId, listingId } : "skip",
  );
  const org = useQuery(landlordApi.orgs.get, { orgId });

  if (listingId && existing === undefined) {
    return <p className="mt-8 text-neutral-600">Loading listing…</p>;
  }

  if (listingId && existing === null) {
    return <p className="mt-8 text-neutral-600">Listing not found.</p>;
  }

  const connectReady = org?.connectReady === true;
  const published = existing?.published === true;
  const verificationStatus = existing?.verificationStatus ?? "draft";
  const initialForm = existing ? formFromListing(existing) : emptyForm;

  return (
    <ListingEditorForm
      key={listingId ?? "new"}
      orgId={orgId}
      listingId={listingId}
      initialForm={initialForm}
      published={published}
      connectReady={connectReady}
      verificationStatus={verificationStatus}
      verificationNote={existing?.verificationNote}
    />
  );
}

