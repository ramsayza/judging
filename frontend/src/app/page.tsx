"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/lib/apiClient";
import type { MeResponse, MyContractRead } from "@/lib/types";

const IS_DEV_ENVIRONMENT = process.env.NEXT_PUBLIC_ENVIRONMENT === "development";

export default function HomePage() {
  const { data: session, status } = useSession();
  const [devEmail, setDevEmail] = useState("");
  const [devName, setDevName] = useState("");
  const [homeHref, setHomeHref] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.apiToken) return;
    Promise.all([
      apiFetch("/api/v1/me", { token: session.apiToken }).then((res) => res.json() as Promise<MeResponse>),
      apiFetch("/api/v1/me/contracts", { token: session.apiToken }).then(
        (res) => res.json() as Promise<MyContractRead[]>
      ),
    ]).then(([me, contracts]) => {
      // A pending invitation is the most urgent thing a signed-in user can
      // have waiting -- surface it immediately rather than making them dig
      // through an org picker first, even if they also manage an org.
      const hasPendingInvitation = contracts.some((c) => c.status === "invitation");
      if (hasPendingInvitation) {
        setHomeHref("/contracts");
        return;
      }
      const hasOrgRole = me.memberships.some((m) => m.role === "organizer");
      setHomeHref(hasOrgRole ? "/onboarding" : "/contracts");
    });
  }, [session?.apiToken]);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Dog Agility Judge Portal</CardTitle>
          <CardDescription>Manage judging contracts and class allocations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && <p className="text-sm text-muted-foreground">Loading...</p>}

          {status === "unauthenticated" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Button className="w-full" onClick={() => signIn("google")}>
                  Sign in with Google
                </Button>
                <Button className="w-full" variant="outline" onClick={() => signIn("facebook")}>
                  Sign in with Facebook
                </Button>
              </div>

              {IS_DEV_ENVIRONMENT && (
                <>
                  <Separator />
                  <form
                    className="space-y-2 rounded-md border border-dashed p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      signIn("dev", { email: devEmail, name: devName });
                    }}
                  >
                    <p className="text-xs font-medium text-muted-foreground">Dev login (development only)</p>
                    <div className="space-y-1">
                      <Label htmlFor="dev-email">Email</Label>
                      <Input
                        id="dev-email"
                        placeholder="email"
                        value={devEmail}
                        onChange={(e) => setDevEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="dev-name">Name</Label>
                      <Input
                        id="dev-name"
                        placeholder="name"
                        value={devName}
                        onChange={(e) => setDevName(e.target.value)}
                      />
                    </div>
                    <Button type="submit" size="sm" variant="secondary">
                      Dev sign in
                    </Button>
                  </form>
                </>
              )}
            </div>
          )}

          {status === "authenticated" && session?.user && (
            <div className="space-y-3">
              <p className="text-sm">
                Signed in as <span className="font-medium">{session.user.email}</span>
              </p>
              {homeHref ? (
                <Button asChild className="w-full">
                  <Link href={homeHref}>
                    {homeHref === "/onboarding" ? "Go to your organizations" : "Go to your contracts"}
                  </Link>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">Loading...</p>
              )}
              <Button className="w-full" variant="ghost" onClick={() => signOut()}>
                Sign out
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
