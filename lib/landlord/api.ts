import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/** Layer 2 landlord portal — use generated Convex `api` directly. */
export const landlordApi = api;

export type OrgSummary = {
  _id: Id<"orgs">;
  name: string;
  connectReady: boolean;
  listingFastPath: boolean;
  role: "org_owner" | "leasing_agent";
};

export type OrgDetail = {
  _id: Id<"orgs">;
  name: string;
  connectReady: boolean;
  stripeConnectAccountId?: string;
  listingFastPath: boolean;
  approvedListingCount: number;
  deniedListingCount: number;
  minApprovedForFastPath: number;
};

export type LandlordListing = {
  _id: Id<"listings">;
  orgId: Id<"orgs">;
  title: string;
  description: string;
  city: string;
  state: string;
  zip: string;
  rentCents: number;
  depositCents: number;
  firstMonthCents: number;
  beds: number;
  baths: number;
  photoUrls: string[];
  published: boolean;
  applicationFeeCents: number;
  verificationStatus: "draft" | "pending_review" | "approved" | "denied";
  verificationNote?: string;
};

export type OrgApplication = {
  _id: Id<"applications">;
  listingId: Id<"listings">;
  listingTitle: string;
  status: string;
  fullName: string;
  email: string;
  submittedAt?: number;
  payments: {
    feePaid: boolean;
    depositPaid: boolean;
    firstMonthPaid: boolean;
  };
};

export type InboxApplication = {
  _id: Id<"applications">;
  listingId: Id<"listings">;
  listingTitle: string;
  status: string;
  fullName: string;
  email: string;
  submittedAt?: number;
};

export type ApplicationReview = {
  _id: Id<"applications">;
  listingId: Id<"listings">;
  status: string;
  fullName: string;
  email: string;
  phone: string;
  message?: string;
  submittedAt?: number;
  payments: {
    feePaid: boolean;
    depositPaid: boolean;
    firstMonthPaid: boolean;
  };
  qualifiedCountOnListing: number;
  listing: {
    title: string;
    city: string;
    state: string;
  };
};

export type ScreeningReport = {
  _id: Id<"screeningReports">;
  applicationId: Id<"applications">;
  vendorRef: string;
  status: "not_started" | "pending" | "complete" | "failed";
  summary?: string;
  missingDocs: string[];
  requestedAt?: number;
  completedAt?: number;
};
