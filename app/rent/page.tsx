import { Suspense } from "react";
import { RentSchedule } from "@/components/rent/RentSchedule";

export default function RentPage() {
  return (
    <Suspense fallback={<p className="px-6 py-12 text-neutral-600">Loading…</p>}>
      <RentSchedule />
    </Suspense>
  );
}
