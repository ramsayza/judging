"use client";

import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { RoleGate } from "@/components/RoleGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/apiClient";
import { useOrgContext } from "@/lib/org-context";
import type { MembershipRole, MembershipWithUserRead } from "@/lib/types";

function MembersPageContent() {
  const { orgId, apiToken } = useOrgContext();
  const [members, setMembers] = useState<MembershipWithUserRead[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiFetch(`/api/v1/organizations/${orgId}/memberships`, { token: apiToken, orgId })
      .then((res) => res.json())
      .then(setMembers);
  }, [orgId, apiToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function approve(membershipId: string) {
    await updateMembership(membershipId, { status: "active" });
  }

  async function setRole(membershipId: string, newRole: MembershipRole) {
    await updateMembership(membershipId, { role: newRole });
  }

  async function remove(membershipId: string) {
    await updateMembership(membershipId, { status: "removed" });
  }

  async function updateMembership(membershipId: string, body: Record<string, string>) {
    setError(null);
    const res = await apiFetch(`/api/v1/organizations/${orgId}/memberships/${membershipId}`, {
      method: "PATCH",
      token: apiToken,
      orgId,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError(`Failed to update membership: ${res.status}`);
      return;
    }
    refresh();
  }

  const pending = members.filter((m) => m.status === "pending");
  const active = members.filter((m) => m.status === "active");

  return (
    <main className="space-y-6">
      <PageHeader title="Members" />
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending approval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pending.length === 0 && <p className="text-sm text-muted-foreground">No pending requests.</p>}
          {pending.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>
                {m.user_name} <span className="text-muted-foreground">({m.user_email})</span>
              </span>
              <Button size="sm" onClick={() => approve(m.id)}>
                Approve
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    {m.user_name} <span className="text-muted-foreground">({m.user_email})</span>
                  </TableCell>
                  <TableCell>
                    <Select value={m.role} onValueChange={(value) => setRole(m.id, value as MembershipRole)}>
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="judge">judge</SelectItem>
                        <SelectItem value="organizer">organizer</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="destructive" onClick={() => remove(m.id)}>
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}

export default function MembersPage() {
  return (
    <RoleGate allow={["organizer"]}>
      <MembersPageContent />
    </RoleGate>
  );
}
