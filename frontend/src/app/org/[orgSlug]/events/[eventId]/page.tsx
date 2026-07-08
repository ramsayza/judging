"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { RoleGate } from "@/components/RoleGate";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/apiClient";
import { useOrgContext } from "@/lib/org-context";
import type { ContractRead, EventClassRead, EventRead } from "@/lib/types";

function EventDetailPageContent({ eventId }: { eventId: string }) {
  const { orgId, orgSlug, role, apiToken } = useOrgContext();
  const canManage = role === "organizer";

  const [event, setEvent] = useState<EventRead | null>(null);
  const [classes, setClasses] = useState<EventClassRead[]>([]);
  const [contracts, setContracts] = useState<ContractRead[]>([]);
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
  }, [orgId, apiToken, eventId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function archiveEvent() {
    setError(null);
    const res = await apiFetch(`/api/v1/organizations/${orgId}/events/${eventId}`, {
      method: "PATCH",
      token: apiToken,
      orgId,
      body: JSON.stringify({ status: "archived" }),
    });
    if (!res.ok) {
      setError(`Failed to archive event: ${res.status}`);
      return;
    }
    refresh();
  }

  if (!event) return <p className="p-8 text-sm text-muted-foreground">Loading...</p>;

  const appointedCount = contracts.filter((c) => c.status === "appointed" || c.status === "complete").length;

  return (
    <main className="space-y-6">
      <PageHeader
        title={event.name}
        description={`${event.venue ?? "No venue set"}${event.venue_postcode ? ` (${event.venue_postcode})` : ""} — ${event.start_date} to ${event.end_date}${event.rule_set ? ` — ${event.rule_set}` : ""} — £${event.cost_per_mile}/mile${event.reimbursement_cap ? ` (capped at £${event.reimbursement_cap})` : ""}`}
        action={
          <div className="flex items-center gap-3">
            {canManage && (
              <>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/org/${orgSlug}/events/${eventId}/edit`}>Edit event</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/org/${orgSlug}/events/${eventId}/requirements`}>Judging requirements</Link>
                </Button>
                {event.status !== "archived" && (
                  <Button size="sm" variant="destructive" onClick={archiveEvent}>
                    Archive event
                  </Button>
                )}
              </>
            )}
            <StatusBadge status={event.status} />
          </div>
        }
      />
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <Link href={`/org/${orgSlug}/events/${eventId}/classes`}>
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle className="text-lg">Classes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {classes.length} {classes.length === 1 ? "class" : "classes"}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href={`/org/${orgSlug}/events/${eventId}/judges`}>
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle className="text-lg">Judges</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {appointedCount} of {contracts.length} appointed
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </main>
  );
}

export default function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  return (
    <RoleGate allow={["organizer"]}>
      <EventDetailPageContent eventId={eventId} />
    </RoleGate>
  );
}
