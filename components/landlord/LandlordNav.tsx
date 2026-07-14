"use client";

import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";
import { usePathname } from "next/navigation";
import { withOrgId } from "@/lib/landlord/paths";

const links = [
  { href: "/landlord", label: "Dashboard", exact: true },
  { href: "/landlord/connect", label: "Connect" },
  { href: "/landlord/listings", label: "Listings" },
  { href: "/landlord/applications", label: "Applications" },
] as const;

export function LandlordNav({ orgId }: { orgId: Id<"orgs"> }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-4 border-b border-neutral-200 pb-4 text-sm">
      {links.map((link) => {
        const active =
          "exact" in link && link.exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={withOrgId(link.href, orgId)}
            className={
              active
                ? "font-medium text-neutral-900"
                : "text-neutral-600 hover:text-neutral-900"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
