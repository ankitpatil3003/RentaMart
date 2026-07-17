"use client";

import Link from "next/link";
import { type ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { Show } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { SiteHeader } from "@/components/SiteHeader";

function AdminNav() {
  const pathname = usePathname();
  const links = [
    { href: "/admin/landlord-requests", label: "Landlord requests" },
    { href: "/admin/listings", label: "Listing reviews" },
  ];

  return (
    <nav className="mt-6 flex flex-wrap gap-4 text-sm">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? "font-medium text-neutral-900 underline"
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

function AdminShell({ children }: { children: ReactNode }) {
  const me = useQuery(api.users.me);
  const router = useRouter();

  useEffect(() => {
    if (me === undefined) return;
    if (!me || !me.roles.includes("platform_admin")) {
      router.replace("/");
    }
  }, [me, router]);

  if (me === undefined) {
    return <p className="px-6 py-12 text-neutral-600">Loading…</p>;
  }

  if (!me || !me.roles.includes("platform_admin")) {
    return (
      <p className="px-6 py-12 text-neutral-600">Redirecting…</p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">
        Platform admin
      </h1>
      <p className="mt-2 text-neutral-600">
        Review landlord access requests and listing authenticity.
      </p>
      <AdminNav />
      <div className="mt-10">{children}</div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f5f1_0%,#ffffff_40%)]">
      <SiteHeader />
      <Show when="signed-in">
        <AdminShell>{children}</AdminShell>
      </Show>
      <Show when="signed-out">
        <p className="px-6 py-12 text-neutral-600">
          Sign in to access admin.{" "}
          <Link href="/sign-in" className="underline">
            Sign in
          </Link>
        </p>
      </Show>
    </main>
  );
}
