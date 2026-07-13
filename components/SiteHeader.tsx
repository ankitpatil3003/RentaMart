"use client";

import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";

export function SiteHeader() {
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
