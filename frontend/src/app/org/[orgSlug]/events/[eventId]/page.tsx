"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/apiClient";
import { useOrgContext } from "@/lib/org-context";
import type {
  AllocationBoardEntry,
  ContractRead,
  EventClassRead,
  EventRead,
  MembershipWithUserRead,
} from "@/lib/types";

export default function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
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

  if (!event) return <p>Loading...</p>;

  const allocatableContracts = contracts.filter((c) => c.status === "accepted" || c.status === "appointed");

  return (
    <main>
      <h1>{event.name}</h1>
      <p>
        {event.venue ?? "No venue set"} — {event.start_date} to {event.end_date} — {event.status}
      </p>
      {error && <p>{error}</p>}

      <section>
        <h2>Classes</h2>
        <ul>
          {classes.map((cls) => {
            const allocations = board.filter((b) => b.event_class_id === cls.id);
            return (
              <li key={cls.id}>
                <strong>{cls.name}</strong>
                <ul>
                  {allocations.map((a) => (
                    <li key={a.allocation_id}>
                      {a.judge_name} ({a.contract_status}){" "}
                      {canManage && (
                        <button onClick={() => removeAllocation(a.contract_id, a.allocation_id)}>Remove</button>
                      )}
                    </li>
                  ))}
                </ul>
                {canManage && (
                  <span>
                    <select
                      value={allocateClassId[cls.id] ?? ""}
                      onChange={(e) => setAllocateClassId({ ...allocateClassId, [cls.id]: e.target.value })}
                    >
                      <option value="">Select accepted judge...</option>
                      {allocatableContracts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.judge_user_id}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => allocate(cls.id)}>Allocate</button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {canManage && (
          <form onSubmit={addClass}>
            <input placeholder="Class name" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} required />
            <button type="submit">Add class</button>
          </form>
        )}
      </section>

      <section>
        <h2>Contracts</h2>
        {canManage && (
          <form onSubmit={inviteJudge}>
            <input
              type="email"
              list="known-judges"
              placeholder="Judge email"
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
            <input
              placeholder="Name (only needed if new)"
              value={inviteJudgeName}
              onChange={(e) => setInviteJudgeName(e.target.value)}
            />
            <button type="submit">Invite judge</button>
          </form>
        )}
        <ul>
          {contracts.map((c) => (
            <li key={c.id}>
              <Link href={`/org/${orgSlug}/contracts/${c.id}`}>Contract {c.id}</Link> — {c.status}
              {canManage && c.status === "accepted" && (
                <button onClick={() => contractAction(c.id, "appoint")}>Appoint</button>
              )}
              {canManage && c.status === "appointed" && (
                <button onClick={() => contractAction(c.id, "complete")}>Complete</button>
              )}
              {canManage && ["invitation", "accepted", "appointed"].includes(c.status) && (
                <button onClick={() => contractAction(c.id, "cancel")}>Cancel</button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
