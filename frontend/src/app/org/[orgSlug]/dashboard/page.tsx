"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/apiClient";
import { useOrgContext } from "@/lib/org-context";
import type { ContractRead, EventRead } from "@/lib/types";

export default function DashboardPage() {
  const { orgId, orgSlug, role, apiToken } = useOrgContext();
  const [contracts, setContracts] = useState<ContractRead[]>([]);
  const [events, setEvents] = useState<EventRead[]>([]);

  useEffect(() => {
    if (role === "judge") {
      apiFetch(`/api/v1/organizations/${orgId}/contracts`, { token: apiToken, orgId })
        .then((res) => res.json())
        .then(setContracts);
    } else {
      apiFetch(`/api/v1/organizations/${orgId}/events`, { token: apiToken, orgId })
        .then((res) => res.json())
        .then(setEvents);
    }
  }, [orgId, apiToken, role]);

  if (role === "judge") {
    const pending = contracts.filter((c) => c.status === "invitation");
    const upcoming = contracts.filter((c) => c.status === "appointed");
    return (
      <main>
        <h1>Your invitations</h1>
        {pending.length === 0 && <p>No pending invitations.</p>}
        <ul>
          {pending.map((c) => (
            <li key={c.id}>
              <Link href={`/org/${orgSlug}/contracts/${c.id}`}>Invitation for event {c.event_id}</Link>
            </li>
          ))}
        </ul>

        <h2>Your upcoming appointments</h2>
        <ul>
          {upcoming.map((c) => (
            <li key={c.id}>
              <Link href={`/org/${orgSlug}/contracts/${c.id}`}>Event {c.event_id}</Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main>
      <h1>Upcoming events</h1>
      <Link href={`/org/${orgSlug}/events/new`}>+ New event</Link>
      <ul>
        {events.map((e) => (
          <li key={e.id}>
            <Link href={`/org/${orgSlug}/events/${e.id}`}>
              {e.name} ({e.start_date} - {e.end_date}) — {e.status}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
