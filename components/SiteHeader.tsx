"use client";

import Link from "next/link";
import { Show, SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { landlordApi } from "@/lib/landlord/api";
import { withOrgId } from "@/lib/landlord/paths";

export function SiteHeader() {
  const { isSignedIn } = useAuth();
  const orgs = useQuery(landlordApi.orgs.listMine, isSignedIn ? {} : "skip");
  const hasOrgs = Boolean(orgs && orgs.length > 0);

  return (
    <header className="border-b border-neutral-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          RentaMart
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/listings" className="text-neutral-700 hover:text-neutral-900">
            Listings
          </Link>
          <Show when="signed-in">
            {hasOrgs && orgs ? (
              <Link
                href={withOrgId("/landlord", orgs[0]._id)}
                className="text-neutral-700 hover:text-neutral-900"
              >
                Landlord
              </Link>
            ) : null}
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button type="button" className="text-neutral-700 hover:text-neutral-900">
                Sign in
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </nav>
      </div>
    </header>
  );
}
