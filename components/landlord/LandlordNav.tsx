"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { usePathname } from "next/navigation";
import { withOrgId } from "@/lib/landlord/paths";
import { landlordApi } from "@/lib/landlord/api";

const baseLinks = [
  { href: "/landlord", label: "Dashboard", exact: true },
  { href: "/landlord/listings", label: "Listings" },
  { href: "/landlord/applications", label: "Applications" },
  { href: "/landlord/notifications", label: "Notifications" },
  { href: "/landlord/messages", label: "Messages" },
  { href: "/landlord/rent", label: "Rent" },
  { href: "/landlord/maintenance", label: "Maintenance" },
] as const;

export function LandlordNav({ orgId }: { orgId: Id<"orgs"> }) {
  const pathname = usePathname();
  const unreadCount = useQuery(api.notifications.unreadCount, { orgId });
  const orgs = useQuery(landlordApi.orgs.listMine);
  const role = orgs?.find((o) => o._id === orgId)?.role;
  const isOwner = role === "org_owner";

  const links = isOwner
    ? [
        baseLinks[0],
        { href: "/landlord/connect", label: "Connect" } as const,
        ...baseLinks.slice(1),
      ]
    : [...baseLinks];

  return (
    <nav className="flex flex-wrap gap-4 border-b border-neutral-200 pb-4 text-sm">
      {links.map((link) => {
        const active =
          "exact" in link && link.exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        const showBadge =
          link.href === "/landlord/notifications" &&
          unreadCount !== undefined &&
          unreadCount > 0;
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
            {showBadge ? (
              <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
