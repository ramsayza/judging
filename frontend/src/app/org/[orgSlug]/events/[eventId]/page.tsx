"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { RoleGate } from "@/components/RoleGate";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/apiClient";
import { useOrgContext } from "@/lib/org-context";
import type {
  AllocationBoardEntry,
  ContractRead,
  EventClassRead,
  EventRead,
  MembershipWithUserRead,
} from "@/lib/types";

function EventDetailPageContent({ eventId }: { eventId: string }) {
  const { orgId, orgSlug, role, apiToken } = useOrgContext();
  const canManage = role === "organizer" || role === "admin";

  const [event, setEvent] = useState<EventRead | null>(null);
  const [classes, setClasses] = useState<EventClassRead[]>([]);
  const [contracts, setContracts] = useState<ContractRead[]>([]);
  const [judges, setJudges] = useState<MembershipWithUserRead[]>([]);
  const [board, setBoard] = useState<AllocationBoardEntry[]>([]);

  const [newClassName, setNewClassName] = useState("");
  const [inviteJudgeEmail, setInviteJudgeEmail] = useState("");
  const [inviteJudgeName, setInviteJudgeName] = useState("");
  const [allocateClassId, setAllocateClassId] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiFetch(`/api/v1/organizations/${orgId}/events/${eventId}`, { token: apiToken, orgId })
      .then((res) => res.json())
      .then(setEvent);
    apiFetch(`/api/v1/organizations/${orgId}/events/${eventId}/classes`, { token: apiToken, orgId })
      .then((res) => res.json())
      .then(setClasses);
    apiFetch(`/api/v1/organizations/${orgId}/contracts?event_id=${eventId}`, { token: apiToken, orgId })
      .then((res) => res.json())
      .then(setContracts);
    apiFetch(`/api/v1/organizations/${orgId}/events/${eventId}/allocations`, { token: apiToken, orgId })
      .then((res) => res.json())
      .then(setBoard);
    if (canManage) {
      apiFetch(`/api/v1/organizations/${orgId}/memberships`, { token: apiToken, orgId })
        .then((res) => res.json())
        .then((all: MembershipWithUserRead[]) => setJudges(all.filter((m) => m.role === "judge" && m.status === "active")));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, apiToken, eventId, canManage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addClass(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await apiFetch(`/api/v1/organizations/${orgId}/events/${eventId}/classes`, {
      method: "POST",
      token: apiToken,
      orgId,
      body: JSON.stringify({ name: newClassName }),
    });
    if (!res.ok) {
      setError(`Failed to add class: ${res.status}`);
      return;
    }
    setNewClassName("");
    refresh();
  }

  async function inviteJudge(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await apiFetch(`/api/v1/organizations/${orgId}/events/${eventId}/contracts`, {
      method: "POST",
      token: apiToken,
      orgId,
      body: JSON.stringify({ judge_email: inviteJudgeEmail, judge_name: inviteJudgeName || undefined }),
    });
    if (!res.ok) {
      setError(`Failed to invite judge: ${res.status}`);
      return;
    }
    setInviteJudgeEmail("");
    setInviteJudgeName("");
    refresh();
  }

  async function allocate(classId: string) {
    const contractId = allocateClassId[classId];
    if (!contractId) return;
    setError(null);
    const res = await apiFetch(`/api/v1/organizations/${orgId}/contracts/${contractId}/allocations`, {
      method: "POST",
      token: apiToken,
      orgId,
      body: JSON.stringify({ event_class_id: classId }),
    });
    if (!res.ok) {
      setError(`Failed to allocate: ${res.status}`);
      return;
    }
    refresh();
  }

  async function removeAllocation(contractId: string, allocationId: string) {
    setError(null);
    const res = await apiFetch(
      `/api/v1/organizations/${orgId}/contracts/${contractId}/allocations/${allocationId}`,
      { method: "DELETE", token: apiToken, orgId }
    );
    if (!res.ok) {
      setError(`Failed to remove allocation: ${res.status}`);
      return;
    }
    refresh();
  }

  async function contractAction(contractId: string, action: "appoint" | "complete" | "cancel") {
    setError(null);
    const res = await apiFetch(`/api/v1/organizations/${orgId}/contracts/${contractId}/${action}`, {
      method: "POST",
      token: apiToken,
      orgId,
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      setError(`Failed to ${action}: ${res.status}`);
      return;
    }
    refresh();
  }

  if (!event) return <p className="p-8 text-sm text-muted-foreground">Loading...</p>;

  const allocatableContracts = contracts.filter((c) => c.status === "accepted" || c.status === "appointed");

  return (
    <main className="space-y-6">
      <PageHeader
        title={event.name}
        description={`${event.venue ?? "No venue set"} — ${event.start_date} to ${event.end_date}`}
        action={
          <div className="flex items-center gap-3">
            {canManage && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/org/${orgSlug}/events/${eventId}/requirements`}>Judging requirements</Link>
              </Button>
            )}
            <StatusBadge status={event.status} />
          </div>
        }
      />
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Classes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {classes.map((cls) => {
            const allocations = board.filter((b) => b.event_class_id === cls.id);
            return (
              <div key={cls.id} className="rounded-md border p-4">
                <p className="font-medium">{cls.name}</p>
                <div className="mt-2 space-y-1">
                  {allocations.map((a) => (
                    <div key={a.allocation_id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        {a.judge_name} <Badge variant="outline">{a.contract_status}</Badge>
                      </span>
                      {canManage && (
                        <Button size="sm" variant="ghost" onClick={() => removeAllocation(a.contract_id, a.allocation_id)}>
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  {allocations.length === 0 && <p className="text-sm text-muted-foreground">No judges allocated yet.</p>}
                </div>
                {canManage && (
                  <div className="mt-3 flex items-center gap-2">
                    <Select
                      value={allocateClassId[cls.id] ?? ""}
                      onValueChange={(value) => setAllocateClassId({ ...allocateClassId, [cls.id]: value })}
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Select accepted judge..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allocatableContracts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.judge_user_id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => allocate(cls.id)}>
                      Allocate
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {classes.length === 0 && <p className="text-sm text-muted-foreground">No classes yet.</p>}

          {canManage && (
            <>
              <Separator />
              <form className="flex items-end gap-2" onSubmit={addClass}>
                <Input placeholder="Class name" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} required />
                <Button type="submit">Add class</Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contracts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManage && (
            <form className="flex flex-wrap items-end gap-2" onSubmit={inviteJudge}>
              <Input
                type="email"
                list="known-judges"
                placeholder="Judge email"
                className="max-w-xs"
                value={inviteJudgeEmail}
                onChange={(e) => setInviteJudgeEmail(e.target.value)}
                required
              />
              <datalist id="known-judges">
                {judges.map((j) => (
                  <option key={j.user_id} value={j.user_email}>
                    {j.user_name}
                  </option>
                ))}
              </datalist>
              <Input
                placeholder="Name (only needed if new)"
                className="max-w-xs"
                value={inviteJudgeName}
                onChange={(e) => setInviteJudgeName(e.target.value)}
              />
              <Button type="submit">Invite judge</Button>
            </form>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link className="font-medium hover:underline" href={`/org/${orgSlug}/contracts/${c.id}`}>
                      Contract {c.id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    {canManage && c.status === "accepted" && (
                      <Button size="sm" onClick={() => contractAction(c.id, "appoint")}>
                        Appoint
                      </Button>
                    )}
                    {canManage && c.status === "appointed" && (
                      <Button size="sm" onClick={() => contractAction(c.id, "complete")}>
                        Complete
                      </Button>
                    )}
                    {canManage && ["invitation", "accepted", "appointed"].includes(c.status) && (
                      <Button size="sm" variant="destructive" onClick={() => contractAction(c.id, "cancel")}>
                        Cancel
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {contracts.length === 0 && <p className="text-sm text-muted-foreground">No contracts yet.</p>}
        </CardContent>
      </Card>
    </main>
  );
}

export default function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  return (
    <RoleGate allow={["organizer", "admin"]}>
      <EventDetailPageContent eventId={eventId} />
    </RoleGate>
  );
}
