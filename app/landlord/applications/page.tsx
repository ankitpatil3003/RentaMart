"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { statusLabel } from "@/lib/format";
import { landlordApi } from "@/lib/landlord/api";
import { withOrgId } from "@/lib/landlord/paths";

function PaymentBadges({
  payments,
}: {
  payments: {
    feePaid: boolean;
    depositPaid: boolean;
    firstMonthPaid: boolean;
  };
}) {
  return (
    <span className="text-xs text-neutral-500">
      {payments.feePaid ? "Fee ✓" : "Fee —"}
      {" · "}
      {payments.depositPaid ? "Deposit ✓" : "Deposit —"}
      {" · "}
      {payments.firstMonthPaid ? "1st month ✓" : "1st month —"}
    </span>
  );
}

export default function LandlordApplicationsPage() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId") as Id<"orgs"> | null;
  const applications = useQuery(
    landlordApi.applications.listAllForOrg,
    orgId ? { orgId } : "skip",
  );

  if (!orgId) {
    return <p className="text-neutral-600">Select an organization.</p>;
  }

  if (applications === undefined) {
    return <p className="text-neutral-600">Loading applications…</p>;
  }

  const needsReview = applications.filter(
    (app) => app.status === "under_review" || app.status === "fee_paid",
  );
  const qualified = applications.filter((app) => app.status === "qualified");
  const moveInReady = applications.filter(
    (app) => app.status === "move_in_ready",
  );
  const refunds = applications.filter(
    (app) => app.status === "refund_eligible" || app.status === "refunded",
  );

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Applications
      </h2>
      <p className="mt-2 text-neutral-600">
        All applicants for your listings. Application fees are non-refundable
        (screening). Deposit and first month are refunded for non-selected
        applicants who paid.
      </p>

      <section className="mt-8">
        <h3 className="text-lg font-medium text-neutral-900">
          All applications ({applications.length})
        </h3>
        {applications.length === 0 ? (
          <p className="mt-4 text-neutral-600">No applications yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-200">
            {applications.map((app) => (
              <li key={app._id} className="py-4">
                <Link
                  href={withOrgId(`/landlord/applications/${app._id}`, orgId)}
                  className="text-lg text-neutral-900 hover:underline"
                >
                  {app.fullName}
                </Link>
                <p className="mt-1 text-sm text-neutral-600">
                  {app.listingTitle} · {statusLabel(app.status)}
                </p>
                <p className="mt-1">
                  <PaymentBadges payments={app.payments} />
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {qualified.length > 0 ? (
        <section className="mt-10 rounded-md border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-medium text-amber-900">
            Ready for selection ({qualified.length})
          </h3>
          <p className="mt-1 text-sm text-amber-800">
            These applicants paid deposit and first month. Choose the most
            qualified — not first-come-first-served.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-amber-900">
            {qualified.map((app) => (
              <li key={app._id}>
                <Link
                  href={withOrgId(`/landlord/applications/${app._id}`, orgId)}
                  className="underline"
                >
                  {app.fullName}
                </Link>{" "}
                — {app.listingTitle}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {moveInReady.length > 0 ? (
        <section className="mt-8">
          <h3 className="text-lg font-medium text-neutral-900">
            Move-in ready ({moveInReady.length})
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-neutral-700">
            {moveInReady.map((app) => (
              <li key={app._id}>
                <Link
                  href={withOrgId(`/landlord/applications/${app._id}`, orgId)}
                  className="underline"
                >
                  {app.fullName}
                </Link>{" "}
                — {app.listingTitle}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {refunds.length > 0 ? (
        <section className="mt-8">
          <h3 className="text-lg font-medium text-neutral-900">
            Refunds ({refunds.length})
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-neutral-700">
            {refunds.map((app) => (
              <li key={app._id}>
                <Link
                  href={withOrgId(`/landlord/applications/${app._id}`, orgId)}
                  className="underline"
                >
                  {app.fullName}
                </Link>{" "}
                — {statusLabel(app.status)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {needsReview.length > 0 && needsReview.length < applications.length ? (
        <section className="mt-8">
          <h3 className="text-lg font-medium text-neutral-900">
            Awaiting your review ({needsReview.length})
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-neutral-700">
            {needsReview.map((app) => (
              <li key={app._id}>
                <Link
                  href={withOrgId(`/landlord/applications/${app._id}`, orgId)}
                  className="underline"
                >
                  {app.fullName}
                </Link>{" "}
                — {app.listingTitle}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
