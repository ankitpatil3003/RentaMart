import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "RentaMart",
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(165deg,#efe8dc_0%,#ffffff_55%)]">
      <SiteHeader />
      <div className="mx-auto flex max-w-3xl flex-col px-6 py-24">
        <h1 className="text-6xl font-semibold tracking-tight text-neutral-900">
          RentaMart
        </h1>
        <p className="mt-5 max-w-xl text-xl leading-relaxed text-neutral-600">
          Find a place. Apply simply. Track your status.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/listings"
            className="inline-flex w-fit rounded-md bg-neutral-900 px-6 py-3 text-white transition-transform hover:-translate-y-0.5"
          >
            Browse listings
          </Link>
          <Link
            href="/become-landlord"
            className="inline-flex w-fit border border-neutral-900 px-6 py-3 text-neutral-900 transition-transform hover:-translate-y-0.5"
          >
            Become a landlord
          </Link>
        </div>
        <p className="mt-4 max-w-md text-sm text-neutral-500">
          Property owners: request access, get verified, then list homes on
          RentaMart.
        </p>
      </div>
    </main>
  );
}
