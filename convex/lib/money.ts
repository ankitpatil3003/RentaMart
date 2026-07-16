import type { Id } from "../_generated/dataModel";

export function appFeeIdempotencyKey(applicationId: Id<"applications">) {
  return `appfee:${applicationId}`;
}

export function depositIdempotencyKey(applicationId: Id<"applications">) {
  return `deposit:${applicationId}`;
}

export function firstMonthIdempotencyKey(applicationId: Id<"applications">) {
  return `firstmonth:${applicationId}`;
}

export function rentIdempotencyKey(
  leaseId: Id<"leases">,
  periodKey: string,
) {
  return `rent:${leaseId}:${periodKey}`;
}

export function defaultApplicationFeeCents(): number {
  return 5000;
}
