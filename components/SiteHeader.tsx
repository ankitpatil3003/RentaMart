"use client";

import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { landlordApi } from "@/lib/landlord/api";
import { withOrgId } from "@/lib/landlord/paths";

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function SiteHeader() {
  const { isAuthenticated } = useConvexAuth();
  const orgs = useQuery(
    landlordApi.orgs.listMine,
    isAuthenticated ? {} : "skip",
  );
  const unreadCount = useQuery(
    api.notifications.unreadCount,
    isAuthenticated ? {} : "skip",
  );
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
            <Link
              href="/applications"
              className="text-neutral-700 hover:text-neutral-900"
            >
              My applications
            </Link>
          </Show>
          <Show when="signed-in">
            <Link
              href="/notifications"
              className="text-neutral-700 hover:text-neutral-900"
            >
              Notifications
              <UnreadBadge count={unreadCount ?? 0} />
            </Link>
          </Show>
          <Show when="signed-in">
            <Link
              href="/messages"
              className="text-neutral-700 hover:text-neutral-900"
            >
              Messages
            </Link>
          </Show>
          <Show when="signed-in">
            <Link href="/rent" className="text-neutral-700 hover:text-neutral-900">
              Rent
            </Link>
          </Show>
          <Show when="signed-in">
            <Link
              href="/maintenance"
              className="text-neutral-700 hover:text-neutral-900"
            >
              Maintenance
            </Link>
          </Show>
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
