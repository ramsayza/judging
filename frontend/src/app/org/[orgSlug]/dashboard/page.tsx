"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    const history = contracts.filter((c) => ["declined", "complete", "cancelled"].includes(c.status));
    return (
      <main className="space-y-6">
        <PageHeader title="Your dashboard" />
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pending invitations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pending.length === 0 && <p className="text-sm text-muted-foreground">No pending invitations.</p>}
              {pending.map((c) => (
                <Link
                  key={c.id}
                  href={`/org/${orgSlug}/contracts/${c.id}`}
                  className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent"
                >
                  <span>Event {c.event_id}</span>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upcoming appointments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming appointments.</p>}
              {upcoming.map((c) => (
                <Link
                  key={c.id}
                  href={`/org/${orgSlug}/contracts/${c.id}`}
                  className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent"
                >
                  <span>Event {c.event_id}</span>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {history.length === 0 && <p className="text-sm text-muted-foreground">No past contracts.</p>}
              {history.map((c) => (
                <Link
                  key={c.id}
                  href={`/org/${orgSlug}/contracts/${c.id}`}
                  className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent"
                >
                  <span>Event {c.event_id}</span>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main>
      <PageHeader
        title="Upcoming events"
        action={
          <Button asChild size="sm">
            <Link href={`/org/${orgSlug}/events/new`}>+ New event</Link>
          </Button>
        }
      />
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
