import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <h1 className="text-5xl font-semibold tracking-tight">RentaMart</h1>
      <p className="mt-4 max-w-xl text-lg text-neutral-600">
        Find a place. Apply simply. Track your status.
      </p>
      <Link
        href="/listings"
        className="mt-8 inline-block rounded-md bg-neutral-900 px-5 py-3 text-white"
      >
        Browse listings
      </Link>
    </main>
  );
}
