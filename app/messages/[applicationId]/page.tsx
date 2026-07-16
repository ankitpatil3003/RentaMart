"use client";

import { Suspense, use } from "react";
import { MessageThread } from "@/components/messages/MessageThread";
import type { Id } from "@/convex/_generated/dataModel";

function MessageThreadPageInner({ id }: { id: Id<"applications"> }) {
  return <MessageThread applicationId={id} />;
}

export default function MessageThreadPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = use(params);
  return (
    <Suspense fallback={<p className="px-6 py-12 text-neutral-600">Loading…</p>}>
      <MessageThreadPageInner id={applicationId as Id<"applications">} />
    </Suspense>
  );
}
