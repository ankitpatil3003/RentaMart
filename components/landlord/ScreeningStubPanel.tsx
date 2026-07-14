"use client";

import { useMutation, useQuery } from "convex/react";
import { useTransition } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { landlordApi } from "@/lib/landlord/api";
import { ScreeningAssist } from "@/components/landlord/ScreeningAssist";

export function ScreeningStubPanel({
  orgId,
  applicationId,
}: {
  orgId: Id<"orgs">;
  applicationId: Id<"applications">;
}) {
  const report = useQuery(landlordApi.screening.getForApplication, {
    orgId,
    applicationId,
  });
  const requestStub = useMutation(landlordApi.screening.requestStubScreening);
  const [isPending, startTransition] = useTransition();

  if (report === undefined) {
    return <p className="mt-6 text-neutral-600">Loading screening…</p>;
  }

  return (
    <section className="mt-10 border-t border-neutral-200 pt-8">
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Screening (sandbox)
      </h2>
      <p className="mt-2 text-sm text-neutral-600">
        Stub vendor only. No live consumer report agency.
      </p>
      {report === null ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await requestStub({ orgId, applicationId });
            });
          }}
          className="mt-4 rounded-md bg-neutral-900 px-5 py-3 text-white disabled:opacity-50"
        >
          {isPending ? "Requesting…" : "Run sandbox screening"}
        </button>
      ) : (
        <div className="mt-4 space-y-2 text-neutral-800">
          <p>
            Status:{" "}
            <span className="font-medium">
              {report.status.replaceAll("_", " ")}
            </span>
          </p>
          {report.summary ? (
            <p className="text-neutral-600">{report.summary}</p>
          ) : null}
          {report.missingDocs.length > 0 ? (
            <ul className="list-disc pl-5 text-sm text-neutral-600">
              {report.missingDocs.map((doc) => (
                <li key={doc}>{doc}</li>
              ))}
            </ul>
          ) : null}
          <ScreeningAssist
            applicationId={applicationId}
            reportId={report._id}
          />
        </div>
      )}
    </section>
  );
}
