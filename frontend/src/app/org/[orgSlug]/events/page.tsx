"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { RoleGate } from "@/components/RoleGate";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/apiClient";
import { useOrgContext } from "@/lib/org-context";
import type { EventRead } from "@/lib/types";

function EventsListPageContent() {
  const { orgId, orgSlug, apiToken } = useOrgContext();
  const [events, setEvents] = useState<EventRead[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    apiFetch(`/api/v1/organizations/${orgId}/events?include_archived=${showArchived}`, {
      token: apiToken,
      orgId,
    })
      .then((res) => res.json())
      .then(setEvents);
  }, [orgId, apiToken, showArchived]);

  return (
    <main>
      <PageHeader
        title="Events"
        action={
          <Button asChild size="sm">
            <Link href={`/org/${orgSlug}/events/new`}>+ New event</Link>
          </Button>
        }
      />
      <label className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        Show archived
      </label>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((e) => (
            <TableRow key={e.id}>
              <TableCell>
                <Link className="font-medium hover:underline" href={`/org/${orgSlug}/events/${e.id}`}>
                  {e.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {e.start_date} – {e.end_date}
              </TableCell>
              <TableCell>
                <StatusBadge status={e.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {events.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No events yet.</p>}
    </main>
  );
}

export default function EventsListPage() {
  return (
    <RoleGate allow={["organizer"]}>
      <EventsListPageContent />
    </RoleGate>
  );
}
