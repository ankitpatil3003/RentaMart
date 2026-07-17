"use client";

import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Show } from "@clerk/nextjs";
import type { Id } from "@/convex/_generated/dataModel";
import { SiteHeader } from "@/components/SiteHeader";
import { LandlordNav } from "@/components/landlord/LandlordNav";
import { landlordApi } from "@/lib/landlord/api";
import { withOrgId } from "@/lib/landlord/paths";

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
    if (orgs === undefined) return;
    if (orgs.length === 0) {
      router.replace("/become-landlord");
      return;
    }
    if (!selectedOrgId) return;
    if (orgIdParam !== selectedOrgId) {
      router.replace(withOrgId(pathname, selectedOrgId));
    }
  }, [orgs, orgIdParam, selectedOrgId, pathname, router]);

  if (orgs === undefined) {
    return <p className="px-6 py-12 text-neutral-600">Loading…</p>;
  }

  if (orgs.length === 0) {
    return (
      <p className="px-6 py-12 text-neutral-600">
        Redirecting to landlord access request…
      </p>
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
