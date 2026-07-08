"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Info } from "lucide-react";

import { GlobalNav } from "@/components/GlobalNav";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { apiFetch } from "@/lib/apiClient";
import { slugify } from "@/lib/utils";
import type { MembershipWithOrgRead, MeResponse, MyContractRead } from "@/lib/types";

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [memberships, setMemberships] = useState<MembershipWithOrgRead[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<MyContractRead[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [organizerEmail, setOrganizerEmail] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
  }, [status, router]);

  useEffect(() => {
    if (!session?.apiToken) return;
    apiFetch("/api/v1/me", { token: session.apiToken })
      .then((res) => res.json())
      .then((data: MeResponse) => {
        setMemberships(data.memberships);
        setIsPlatformAdmin(data.user.is_platform_admin);
      });
    apiFetch("/api/v1/me/contracts", { token: session.apiToken })
      .then((res) => res.json())
      .then((data: MyContractRead[]) => setPendingInvitations(data.filter((c) => c.status === "invitation")));
  }, [session?.apiToken]);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await apiFetch("/api/v1/onboarding/organizations", {
      method: "POST",
      token: session?.apiToken,
      body: JSON.stringify({
        name,
        slug,
        organizer_email: organizerEmail,
        organizer_name: organizerName || undefined,
      }),
    });
    if (!res.ok) {
      setMessage(`Failed to create organization: ${res.status}`);
      return;
    }
    // The platform admin who creates an org isn't a member of it -- stay
    // here rather than navigating into an org they have no access to.
    setName("");
    setSlug("");
    setSlugManuallyEdited(false);
    setOrganizerEmail("");
    setOrganizerName("");
    setMessage("Organization created.");
  }

  if (status === "loading" || (status === "authenticated" && !session?.apiToken)) {
    return <p className="p-8 text-sm text-muted-foreground">Loading...</p>;
  }
  if (status !== "authenticated") {
    return null;
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <GlobalNav />
      <PageHeader title="Welcome" description="Your organizations." />
      {message && <p className="mb-4 text-sm text-destructive">{message}</p>}
      {pendingInvitations.length > 0 && (
        <Link
          href="/contracts"
          className="mb-4 block rounded-md border border-primary/30 bg-primary/5 p-3 text-sm font-medium hover:bg-primary/10"
        >
          You have {pendingInvitations.length} pending judging invitation
          {pendingInvitations.length > 1 ? "s" : ""} — view {pendingInvitations.length > 1 ? "them" : "it"} in Your
          Contracts.
        </Link>
      )}

      <div className="space-y-3">
        {memberships.length === 0 && (
          <p className="text-sm text-muted-foreground">
            You&apos;re not a member of any organization yet — an organizer or platform admin needs to add you.
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
      </div>

      {isPlatformAdmin && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Create a new organization</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-wrap items-end gap-3" onSubmit={createOrg}>
              <div className="flex-1 space-y-1">
                <Label htmlFor="org-name">Organization name</Label>
                <Input
                  id="org-name"
                  placeholder="Organization name"
                  value={name}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    setName(nextName);
                    if (!slugManuallyEdited) setSlug(slugify(nextName));
                  }}
                  required
                />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-1">
                  <Label htmlFor="org-slug">URL slug</Label>
                  <Tooltip>
                    <TooltipTrigger type="button">
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      This becomes part of the organization&apos;s URL (/org/your-slug). Lowercase letters, numbers,
                      and hyphens only.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="org-slug"
                  placeholder="url-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugManuallyEdited(true);
                    setSlug(e.target.value.toLowerCase());
                  }}
                  pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
                  required
                />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-1">
                  <Label htmlFor="organizer-email">Initial organizer email</Label>
                  <Tooltip>
                    <TooltipTrigger type="button">
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      You provision the org but aren&apos;t a member of it -- this person becomes its first
                      organizer.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="organizer-email"
                  type="email"
                  placeholder="organizer@example.com"
                  value={organizerEmail}
                  onChange={(e) => setOrganizerEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="organizer-name">Organizer name (only needed if new)</Label>
                <Input
                  id="organizer-name"
                  placeholder="Name"
                  value={organizerName}
                  onChange={(e) => setOrganizerName(e.target.value)}
                />
              </div>
              <Button type="submit">Create organization</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
