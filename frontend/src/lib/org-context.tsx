"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/apiClient";
import type { MembershipWithOrgRead, MeResponse } from "@/lib/types";

interface OrgContextValue {
  orgId: string;
  orgSlug: string;
  role: MembershipWithOrgRead["role"];
  membershipStatus: MembershipWithOrgRead["status"];
  apiToken: string;
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function useOrgContext(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    throw new Error("useOrgContext must be used within an OrgProvider");
  }
  return ctx;
}

export function OrgProvider({ orgSlug, children }: { orgSlug: string; children: ReactNode }) {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [membership, setMembership] = useState<MembershipWithOrgRead | null | "loading">("loading");

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.replace("/");
      return;
    }
    if (sessionStatus !== "authenticated" || !session?.apiToken) return;

    let cancelled = false;
    apiFetch("/api/v1/me", { token: session.apiToken })
      .then((res) => res.json())
      .then((data: MeResponse) => {
        if (cancelled) return;
        const found = data.memberships.find((m) => m.organization_slug === orgSlug) ?? null;
        if (!found) {
          router.replace("/onboarding");
          return;
        }
        setMembership(found);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.apiToken, sessionStatus, orgSlug, router]);

  if (membership === "loading" || sessionStatus === "loading") {
    return <p className="p-8 text-sm text-muted-foreground">Loading...</p>;
  }
  if (membership === null) {
    return null;
  }
  if (membership.status === "pending") {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{membership.organization_name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your request to join this organization is pending admin approval.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <OrgContext.Provider
      value={{
        orgId: membership.organization_id,
        orgSlug,
        role: membership.role,
        membershipStatus: membership.status,
        apiToken: session!.apiToken!,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}
