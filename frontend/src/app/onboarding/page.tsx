"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/apiClient";
import type { MembershipWithOrgRead, MeResponse, OrganizationPublicRead } from "@/lib/types";

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [memberships, setMemberships] = useState<MembershipWithOrgRead[]>([]);
  const [orgs, setOrgs] = useState<OrganizationPublicRead[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
  }, [status, router]);

  useEffect(() => {
    if (!session?.apiToken) return;
    apiFetch("/api/v1/me", { token: session.apiToken })
      .then((res) => res.json())
      .then((data: MeResponse) => setMemberships(data.memberships));
    apiFetch("/api/v1/organizations", { token: session.apiToken })
      .then((res) => res.json())
      .then(setOrgs);
  }, [session?.apiToken]);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await apiFetch("/api/v1/onboarding/organizations", {
      method: "POST",
      token: session?.apiToken,
      body: JSON.stringify({ name, slug }),
    });
    if (!res.ok) {
      setMessage(`Failed to create organization: ${res.status}`);
      return;
    }
    const org = await res.json();
    router.replace(`/org/${org.slug}/dashboard`);
  }

  async function joinOrg(org: OrganizationPublicRead) {
    setMessage(null);
    const res = await apiFetch(`/api/v1/onboarding/organizations/${org.id}/join`, {
      method: "POST",
      token: session?.apiToken,
    });
    if (!res.ok) {
      setMessage(`Failed to join organization: ${res.status}`);
      return;
    }
    router.replace(`/org/${org.slug}/dashboard`);
  }

  if (status === "loading" || (status === "authenticated" && !session?.apiToken)) {
    return <p className="p-8 text-sm text-muted-foreground">Loading...</p>;
  }
  if (status !== "authenticated") {
    return null;
  }

  const alreadyMemberIds = new Set(memberships.map((m) => m.organization_id));
  const joinableOrgs = orgs.filter((org) => !alreadyMemberIds.has(org.id));

  return (
    <main className="mx-auto max-w-3xl p-6">
      <PageHeader title="Welcome" description="Your organizations, and ways to join more." />
      {message && <p className="mb-4 text-sm text-destructive">{message}</p>}

      <Tabs defaultValue="my-orgs">
        <TabsList>
          <TabsTrigger value="my-orgs">My Organizations</TabsTrigger>
          <TabsTrigger value="create-or-join">Create or join</TabsTrigger>
        </TabsList>

        <TabsContent value="my-orgs" className="space-y-3">
          {memberships.length === 0 && (
            <p className="text-sm text-muted-foreground">
              You&apos;re not a member of any organization yet — use the &quot;Create or join&quot; tab.
            </p>
          )}
          {memberships.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{m.organization_name}</span>
                  <Badge variant="outline">{m.role}</Badge>
                  <StatusBadge status={m.status} />
                </div>
                {m.status === "active" ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/org/${m.organization_slug}/dashboard`}>Open</Link>
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Awaiting admin approval</span>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="create-or-join" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Create a new organization</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="flex flex-wrap items-end gap-3" onSubmit={createOrg}>
                <div className="flex-1 space-y-1">
                  <Input placeholder="Organization name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="flex-1 space-y-1">
                  <Input
                    placeholder="url-slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
                    required
                  />
                </div>
                <Button type="submit">Create organization</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Join an existing organization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {joinableOrgs.length === 0 && (
                <p className="text-sm text-muted-foreground">No other organizations to join.</p>
              )}
              {joinableOrgs.map((org) => (
                <div key={org.id} className="flex items-center justify-between rounded-md border p-3">
                  <span>{org.name}</span>
                  <Button size="sm" variant="outline" onClick={() => joinOrg(org)}>
                    Join
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
