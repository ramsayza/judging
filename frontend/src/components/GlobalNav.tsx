"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/apiClient";
import type { MeResponse } from "@/lib/types";

export function GlobalNav() {
  const { data: session } = useSession();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    if (!session?.apiToken) return;
    apiFetch("/api/v1/me", { token: session.apiToken })
      .then((res) => res.json())
      .then((data: MeResponse) => setIsPlatformAdmin(data.user.is_platform_admin));
  }, [session?.apiToken]);

  return (
    <nav className="mb-6 flex items-center justify-between border-b pb-4">
      <Link href="/contracts" className="text-sm font-medium">
        My Contracts
      </Link>
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="sm">
          <Link href="/onboarding">My Organizations</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/profile">Your Details</Link>
        </Button>
        {isPlatformAdmin && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/rule-set-copies">Admin</Link>
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    </nav>
  );
}
