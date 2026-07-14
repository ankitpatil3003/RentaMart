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
    case "deposit_due":
      return "Deposit due";
    case "deposit_paid":
      return "Deposit paid";
    case "first_month_due":
      return "First month due";
    case "first_month_paid":
      return "First month paid";
    case "move_in_ready":
      return "Move-in ready";
    case "canceled":
      return "Canceled";
    default:
      return status.replaceAll("_", " ");
  }
}

export function paymentTypeLabel(type: string): string {
  switch (type) {
    case "application_fee":
      return "Application fee";
    case "deposit":
      return "Deposit";
    case "first_month":
      return "First month rent";
    default:
      return type.replaceAll("_", " ");
  }
}
