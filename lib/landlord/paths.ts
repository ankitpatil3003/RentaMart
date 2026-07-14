import type { Id } from "@/convex/_generated/dataModel";

export function withOrgId(path: string, orgId: Id<"orgs"> | null | undefined): string {
  if (!orgId) return path;
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("orgId", orgId);
  return `${base}?${params.toString()}`;
}
