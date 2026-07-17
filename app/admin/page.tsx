"use client";

import Link from "next/link";

export default function AdminHomePage() {
  return (
    <div>
      <p className="text-neutral-600">
        Choose a queue from the navigation above.
      </p>
      <ul className="mt-4 list-inside list-disc text-sm text-neutral-700">
        <li>
          <Link href="/admin/landlord-requests" className="underline">
            Landlord requests
          </Link>
        </li>
        <li>
          <Link href="/admin/listings" className="underline">
            Listing reviews
          </Link>
        </li>
      </ul>
    </div>
  );
}
