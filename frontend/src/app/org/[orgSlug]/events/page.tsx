"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/apiClient";
import { useOrgContext } from "@/lib/org-context";
import type { EventRead } from "@/lib/types";

export default function EventsListPage() {
  const { orgId, orgSlug, role, apiToken } = useOrgContext();
  const [events, setEvents] = useState<EventRead[]>([]);

  useEffect(() => {
    apiFetch(`/api/v1/organizations/${orgId}/events`, { token: apiToken, orgId })
      .then((res) => res.json())
      .then(setEvents);
  }, [orgId, apiToken]);

  return (
    <main>
      <h1>Events</h1>
      {(role === "organizer" || role === "admin") && <Link href={`/org/${orgSlug}/events/new`}>+ New event</Link>}
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
