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
    case "qualified":
      return "Qualified — awaiting landlord selection";
    case "refund_eligible":
      return "Refund eligible";
    case "refunded":
      return "Refunded";
    case "moved":
      return "Moved in";
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
    case "rent":
      return "Monthly rent";
    default:
      return type.replaceAll("_", " ");
  }
}

export function rentChargeStatusLabel(status: string): string {
  switch (status) {
    case "due":
      return "Due";
    case "checkout_open":
      return "Checkout open";
    case "paid":
      return "Paid";
    case "failed":
      return "Failed";
    default:
      return status.replaceAll("_", " ");
  }
}

export function maintenanceStatusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Open";
    case "in_progress":
      return "In progress";
    case "resolved":
      return "Resolved";
    default:
      return status.replaceAll("_", " ");
  }
}

export function notificationTypeLabel(type: string): string {
  switch (type) {
    case "application_fee_paid":
      return "Application fee paid";
    case "approved_for_deposit":
      return "Approved for deposit";
    case "qualified":
      return "Qualified";
    case "selected_tenant":
      return "Selected as tenant";
    case "not_selected":
      return "Not selected";
    case "refund_completed":
      return "Refund completed";
    case "moved_in":
      return "Moved in";
    case "denied":
      return "Denied";
    case "tenant_selected":
      return "Tenant selected";
    default:
      return type.replaceAll("_", " ");
  }
}

export function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
    new Date(timestamp),
  );
}
