import type { Id } from "../_generated/dataModel";

export function appFeeIdempotencyKey(applicationId: Id<"applications">) {
  return `appfee:${applicationId}`;
}

export function defaultApplicationFeeCents(): number {
  return 5000;
}
