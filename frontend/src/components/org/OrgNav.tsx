"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOrgContext } from "@/lib/org-context";
import type { MembershipRole } from "@/lib/types";

const NAV_ITEMS: { href: string; label: string; allow: MembershipRole[] }[] = [
  { href: "dashboard", label: "Dashboard", allow: ["judge", "organizer", "admin"] },
  { href: "events", label: "Events", allow: ["organizer", "admin"] },
  { href: "contracts", label: "Contracts", allow: ["judge", "organizer", "admin"] },
  { href: "members", label: "Members", allow: ["admin"] },
  { href: "settings/email-template", label: "Settings", allow: ["organizer", "admin"] },
];

export function OrgNav({ orgSlug }: { orgSlug: string }) {
  const { role } = useOrgContext();
  const pathname = usePathname();

  const items = NAV_ITEMS.filter((item) => item.allow.includes(role));

  return (
    <nav className="mb-6 flex items-center justify-between border-b pb-4">
      <div className="flex items-center gap-1">
        {items.map((item) => {
          const href = `/org/${orgSlug}/${item.href}`;
          const isActive = pathname?.startsWith(href);
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="sm">
          <Link href="/onboarding">Switch organization</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/profile">Your Details</Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    </nav>
  );
}
