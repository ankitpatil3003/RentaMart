"use client";

import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Show } from "@clerk/nextjs";
import type { Id } from "@/convex/_generated/dataModel";
import { SiteHeader } from "@/components/SiteHeader";
import { LandlordNav } from "@/components/landlord/LandlordNav";
import { landlordApi } from "@/lib/landlord/api";
import { withOrgId } from "@/lib/landlord/paths";

function CreateOrgForm() {
  const create = useMutation(landlordApi.orgs.create);
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const orgId = await create({ name: name.trim() });
        router.replace(withOrgId(pathname, orgId));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not create organization",
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 grid max-w-md gap-4">
      <label className="block text-sm text-neutral-600">
        Organization name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-neutral-900 px-5 py-3 text-white disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create organization"}
      </button>
    </form>
  );
}

function OrgSwitcher({
  orgs,
  orgId,
}: {
  orgs: Array<{ _id: Id<"orgs">; name: string }>;
  orgId: Id<"orgs">;
}) {
  const router = useRouter();
  const pathname = usePathname();

  if (orgs.length < 2) {
    const current = orgs.find((o) => o._id === orgId);
    return (
      <p className="mt-2 text-sm text-neutral-600">
        {current?.name ?? "Organization"}
      </p>
    );
  }

  return (
    <label className="mt-2 block text-sm text-neutral-600">
      Organization
      <select
        value={orgId}
        onChange={(e) => {
          router.replace(withOrgId(pathname, e.target.value as Id<"orgs">));
        }}
        className="mt-1 block w-full max-w-xs border border-neutral-300 bg-white px-3 py-2 outline-none focus:border-neutral-900"
      >
        {orgs.map((org) => (
          <option key={org._id} value={org._id}>
            {org.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function LandlordShell({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const orgs = useQuery(landlordApi.orgs.listMine);
  const orgIdParam = searchParams.get("orgId");

  const selectedOrgId = useMemo(() => {
    if (!orgs || orgs.length === 0) return null;
    if (orgIdParam && orgs.some((o) => o._id === orgIdParam)) {
      return orgIdParam as Id<"orgs">;
    }
    return orgs[0]!._id;
  }, [orgs, orgIdParam]);

  useEffect(() => {
    if (!orgs || orgs.length === 0 || !selectedOrgId) return;
    if (orgIdParam !== selectedOrgId) {
      router.replace(withOrgId(pathname, selectedOrgId));
    }
  }, [orgs, orgIdParam, selectedOrgId, pathname, router]);

  if (orgs === undefined) {
    return <p className="px-6 py-12 text-neutral-600">Loading…</p>;
  }

  if (orgs.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">
          Landlord portal
        </h1>
        <p className="mt-2 text-neutral-600">
          Create an organization to manage listings and applications.
        </p>
        <CreateOrgForm />
      </div>
    );
  }

  if (!selectedOrgId) {
    return <p className="px-6 py-12 text-neutral-600">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">
          Landlord portal
        </h1>
        <OrgSwitcher orgs={orgs} orgId={selectedOrgId} />
        <div className="mt-6">
          <LandlordNav orgId={selectedOrgId} />
        </div>
      </div>
      {children}
    </div>
  );
}

export default function LandlordLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f5f1_0%,#ffffff_40%)]">
      <SiteHeader />
      <Show when="signed-in">
        <Suspense
          fallback={<p className="px-6 py-12 text-neutral-600">Loading…</p>}
        >
          <LandlordShell>{children}</LandlordShell>
        </Suspense>
      </Show>
      <Show when="signed-out">
        <p className="px-6 py-12 text-neutral-600">
          Sign in to access the landlord portal.{" "}
          <Link href="/sign-in" className="underline">
            Sign in
          </Link>
        </p>
      </Show>
    </main>
  );
}
