"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function GlobalNav() {
  return (
    <nav className="mb-6 flex items-center justify-between border-b pb-4">
      <Link href="/contracts" className="text-sm font-medium">
        My Contracts
      </Link>
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="sm">
          <Link href="/onboarding">My Organizations</Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    </nav>
  );
}
