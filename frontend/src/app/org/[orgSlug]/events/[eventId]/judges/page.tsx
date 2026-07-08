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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/apiClient";
import { useOrgContext } from "@/lib/org-context";
import type {
  AllocationBoardEntry,
  ContractCopyRead,
  ContractRead,
  EventClassRead,
  EventContractRequirementsRead,
  EventRead,
  MembershipWithUserRead,
} from "@/lib/types";

function EventJudgesPageContent({ eventId }: { eventId: string }) {
  const { orgId, orgSlug, role, apiToken } = useOrgContext();
  const canManage = role === "organizer";

  const [event, setEvent] = useState<EventRead | null>(null);
  const [classes, setClasses] = useState<EventClassRead[]>([]);
  const [contracts, setContracts] = useState<ContractRead[]>([]);
  const [judges, setJudges] = useState<MembershipWithUserRead[]>([]);
  const [board, setBoard] = useState<AllocationBoardEntry[]>([]);
  const [requirementFieldsCount, setRequirementFieldsCount] = useState<number | null>(null);
  const [contractCopies, setContractCopies] = useState<Record<string, ContractCopyRead>>({});

  const [inviteJudgeEmail, setInviteJudgeEmail] = useState("");
  const [inviteJudgeName, setInviteJudgeName] = useState("");
  const [ringAssignContractId, setRingAssignContractId] = useState("");
  const [ringAssignRing, setRingAssignRing] = useState("");
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
    apiFetch(`/api/v1/organizations/${orgId}/events/${eventId}/contract-requirements`, { token: apiToken, orgId })
      .then((res) => res.json())
      .then((data: EventContractRequirementsRead) => setRequirementFieldsCount(data.fields.length));
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

  useEffect(() => {
    const accepted = contracts.filter((c) => c.status === "accepted");
    accepted.forEach((c) => {
      apiFetch(`/api/v1/organizations/${orgId}/contracts/${c.id}/contract-copy`, { token: apiToken, orgId })
        .then((res) => res.json())
        .then((data: ContractCopyRead) => setContractCopies((prev) => ({ ...prev, [c.id]: data })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, apiToken, contracts]);

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

  async function assignRing(e: React.FormEvent) {
    e.preventDefault();
    if (!ringAssignContractId || !ringAssignRing) return;
    setError(null);
    const res = await apiFetch(
      `/api/v1/organizations/${orgId}/contracts/${ringAssignContractId}/allocations/by-ring`,
      {
        method: "POST",
        token: apiToken,
        orgId,
        body: JSON.stringify({ ring: ringAssignRing }),
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(`Failed to assign ring: ${body?.detail ?? res.status}`);
      return;
    }
    setRingAssignContractId("");
    setRingAssignRing("");
    refresh();
  }

  if (!event) return <p className="p-8 text-sm text-muted-foreground">Loading...</p>;

  const allocatableContracts = contracts.filter(
    (c) =>
      (c.status === "accepted" || c.status === "appointed") &&
      !(contractCopies[c.id]?.effective_body && !contractCopies[c.id]?.signed_at)
  );
  const rings = Array.from(new Set(classes.map((c) => c.ring).filter((r): r is string => !!r))).sort();
  const ringJudges = rings.map((ring) => {
    const classIds = new Set(classes.filter((c) => c.ring === ring).map((c) => c.id));
    const names = Array.from(new Set(board.filter((b) => classIds.has(b.event_class_id)).map((b) => b.judge_name)));
    return { ring, names };
  });

  return (
    <main className="space-y-6">
      <PageHeader
        title={`Judges — ${event.name}`}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/org/${orgSlug}/events/${eventId}`}>Back to event</Link>
          </Button>
        }
      />
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Judges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManage && requirementFieldsCount === 0 && (
            <div className="flex items-center justify-between rounded-md border border-dashed p-3 text-sm">
              <span className="text-muted-foreground">Set judging requirements before inviting a judge.</span>
              <Button asChild size="sm" variant="outline">
                <Link href={`/org/${orgSlug}/events/${eventId}/requirements`}>Set requirements</Link>
              </Button>
            </div>
          )}
          {canManage && requirementFieldsCount !== null && requirementFieldsCount > 0 && (
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
                      {c.judge_name}
                    </Link>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <StatusBadge status={c.status} />
                    {contractCopies[c.id]?.effective_body && !contractCopies[c.id]?.signed_at && (
                      <Badge variant="warning">Unsigned</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    {canManage && c.status === "accepted" && (
                      <>
                        <Button
                          size="sm"
                          disabled={!!contractCopies[c.id]?.effective_body && !contractCopies[c.id]?.signed_at}
                          onClick={() => contractAction(c.id, "appoint")}
                        >
                          Appoint
                        </Button>
                        {contractCopies[c.id]?.effective_body && !contractCopies[c.id]?.signed_at && (
                          <span className="text-xs text-muted-foreground">Waiting for judge to sign</span>
                        )}
                      </>
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

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Assign judge to a ring</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex flex-wrap items-end gap-2" onSubmit={assignRing}>
              <Select value={ringAssignContractId} onValueChange={setRingAssignContractId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select accepted/appointed judge..." />
                </SelectTrigger>
                <SelectContent>
                  {allocatableContracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.judge_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ringAssignRing} onValueChange={setRingAssignRing}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select ring..." />
                </SelectTrigger>
                <SelectContent>
                  {rings.map((ring) => (
                    <SelectItem key={ring} value={ring}>
                      Ring {ring}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit">Assign to ring</Button>
            </form>
            {rings.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No classes have a ring set yet — set one on the{" "}
                <Link href={`/org/${orgSlug}/events/${eventId}/classes`} className="underline">
                  Classes page
                </Link>{" "}
                first.
              </p>
            )}
            {ringJudges.length > 0 && (
              <div className="space-y-1 text-sm">
                {ringJudges.map(({ ring, names }) => (
                  <p key={ring}>
                    <span className="font-medium">Ring {ring}:</span>{" "}
                    <span className="text-muted-foreground">{names.length > 0 ? names.join(", ") : "unassigned"}</span>
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}

export default function EventJudgesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  return (
    <RoleGate allow={["organizer"]}>
      <EventJudgesPageContent eventId={eventId} />
    </RoleGate>
  );
}
