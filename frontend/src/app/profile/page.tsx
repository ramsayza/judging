"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { GlobalNav } from "@/components/GlobalNav";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/apiClient";
import type { ClassRestriction, ClassRestrictionOptions, MeResponse, UserDetailsRead } from "@/lib/types";

function restrictionLabel(r: ClassRestriction): string {
  return [r.discipline, r.level].filter(Boolean).join(" ");
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const apiToken = session?.apiToken;

  const [hasJudgeRole, setHasJudgeRole] = useState(false);
  const [details, setDetails] = useState<UserDetailsRead | null>(null);
  const [options, setOptions] = useState<ClassRestrictionOptions | null>(null);
  const [homePostcode, setHomePostcode] = useState("");
  const [restrictions, setRestrictions] = useState<ClassRestriction[]>([]);
  const [newDiscipline, setNewDiscipline] = useState("");
  const [newLevel, setNewLevel] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
  }, [status, router]);

  useEffect(() => {
    if (!apiToken) return;
    apiFetch("/api/v1/me", { token: apiToken })
      .then((res) => res.json())
      .then((data: MeResponse) => setHasJudgeRole(data.memberships.some((m) => m.role === "judge")));
    apiFetch("/api/v1/me/details", { token: apiToken })
      .then((res) => res.json())
      .then((data: UserDetailsRead) => {
        setDetails(data);
        setHomePostcode(data.home_postcode ?? "");
        setRestrictions(data.class_restrictions);
      });
  }, [apiToken]);

  useEffect(() => {
    if (!apiToken || !hasJudgeRole) return;
    apiFetch("/api/v1/me/class-restriction-options", { token: apiToken })
      .then((res) => res.json())
      .then(setOptions);
  }, [apiToken, hasJudgeRole]);

  function addRestriction() {
    if (!newDiscipline && !newLevel) return;
    setRestrictions([
      ...restrictions,
      { discipline: newDiscipline || null, level: newLevel || null },
    ]);
    setNewDiscipline("");
    setNewLevel("");
  }

  function removeRestriction(index: number) {
    setRestrictions(restrictions.filter((_, i) => i !== index));
  }

  async function save() {
    if (!apiToken) return;
    setMessage(null);
    const res = await apiFetch("/api/v1/me/details", {
      method: "PATCH",
      token: apiToken,
      body: JSON.stringify({
        home_postcode: homePostcode || null,
        class_restrictions: restrictions,
      }),
    });
    if (!res.ok) {
      setMessage(`Failed to save: ${res.status}`);
      return;
    }
    setMessage("Saved.");
  }

  if (status === "loading" || (status === "authenticated" && !apiToken) || !details) {
    return <p className="p-8 text-sm text-muted-foreground">Loading...</p>;
  }
  if (status !== "authenticated") return null;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <GlobalNav />
      <PageHeader title="Your details" />
      {message && <p className="mb-4 text-sm text-muted-foreground">{message}</p>}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              {details.avatar_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={details.avatar_url} alt="" className="h-12 w-12 rounded-full" />
              )}
              <div>
                <p className="font-medium">{details.name}</p>
                <p className="text-sm text-muted-foreground">{details.email}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Synced from your Google/Facebook account.</p>
          </CardContent>
        </Card>

        {hasJudgeRole && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Judge details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="home-postcode">Home postcode</Label>
                <Input
                  id="home-postcode"
                  className="max-w-xs"
                  value={homePostcode}
                  onChange={(e) => setHomePostcode(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Classes you can&apos;t judge</Label>
                <div className="flex flex-wrap gap-2">
                  {restrictions.map((r, i) => (
                    <Badge key={i} variant="outline" className="flex items-center gap-1">
                      {restrictionLabel(r)}
                      <button type="button" onClick={() => removeRestriction(i)} className="ml-1 text-muted-foreground">
                        ×
                      </button>
                    </Badge>
                  ))}
                  {restrictions.length === 0 && (
                    <p className="text-sm text-muted-foreground">No restrictions added.</p>
                  )}
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <Select value={newDiscipline} onValueChange={setNewDiscipline}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Discipline" />
                    </SelectTrigger>
                    <SelectContent>
                      {(options?.disciplines ?? []).map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={newLevel} onValueChange={setNewLevel}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Level" />
                    </SelectTrigger>
                    <SelectContent>
                      {(options?.levels ?? []).map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={addRestriction}>
                    Add restriction
                  </Button>
                </div>
              </div>

              <Button onClick={save}>Save</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
