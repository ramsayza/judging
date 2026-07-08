"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { GlobalNav } from "@/components/GlobalNav";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/apiClient";
import type { MeResponse, RuleSetContractCopyRead } from "@/lib/types";

export default function RuleSetCopiesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const apiToken = session?.apiToken;

  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean | null>(null);
  const [copies, setCopies] = useState<RuleSetContractCopyRead[]>([]);
  const [messages, setMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
  }, [status, router]);

  useEffect(() => {
    if (!apiToken) return;
    apiFetch("/api/v1/me", { token: apiToken })
      .then((res) => res.json())
      .then((data: MeResponse) => setIsPlatformAdmin(data.user.is_platform_admin));
  }, [apiToken]);

  useEffect(() => {
    if (!apiToken || !isPlatformAdmin) return;
    apiFetch("/api/v1/admin/rule-set-copies", { token: apiToken })
      .then((res) => res.json())
      .then(setCopies);
  }, [apiToken, isPlatformAdmin]);

  function updateBody(ruleSet: string, body: string) {
    setCopies(copies.map((c) => (c.rule_set === ruleSet ? { ...c, body } : c)));
  }

  async function save(ruleSet: string, body: string) {
    if (!apiToken) return;
    setMessages({ ...messages, [ruleSet]: "" });
    const res = await apiFetch(`/api/v1/admin/rule-set-copies/${ruleSet}`, {
      method: "PATCH",
      token: apiToken,
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      setMessages({ ...messages, [ruleSet]: `Failed to save: ${res.status}` });
      return;
    }
    setMessages({ ...messages, [ruleSet]: "Saved." });
  }

  if (status === "loading" || (status === "authenticated" && !apiToken) || isPlatformAdmin === null) {
    return <p className="p-8 text-sm text-muted-foreground">Loading...</p>;
  }
  if (status !== "authenticated") return null;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <GlobalNav />
      {!isPlatformAdmin ? (
        <Card className="mx-auto mt-12 max-w-md">
          <CardHeader>
            <CardTitle>No access</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">This page is for platform admins only.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <PageHeader
            title="Rule set contract copies"
            description="The default sample contract text for each rule set. Organizers can override this per event."
          />
          <div className="space-y-4">
            {copies.map((c) => (
              <Card key={c.rule_set}>
                <CardHeader>
                  <CardTitle className="text-lg">{c.rule_set}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {messages[c.rule_set] && (
                    <p className="text-sm text-muted-foreground">{messages[c.rule_set]}</p>
                  )}
                  <Textarea
                    rows={6}
                    value={c.body}
                    onChange={(e) => updateBody(c.rule_set, e.target.value)}
                  />
                  <Button size="sm" onClick={() => save(c.rule_set, c.body)}>
                    Save
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
