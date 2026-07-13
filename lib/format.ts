export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function statusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Submitted";
    case "fee_pending":
      return "Application fee pending";
    case "fee_paid":
      return "Application fee paid";
    case "fee_failed":
      return "Application fee failed";
    case "under_review":
      return "Under review";
    case "approved":
      return "Approved";
    case "denied":
      return "Denied";
    case "canceled":
      return "Canceled";
    default:
      return status.replaceAll("_", " ");
  }
}
