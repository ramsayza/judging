"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { RoleGate } from "@/components/RoleGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/apiClient";
import { useOrgContext } from "@/lib/org-context";

function NewEventPageContent() {
  const { orgId, orgSlug, apiToken } = useOrgContext();
  const router = useRouter();

  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await apiFetch(`/api/v1/organizations/${orgId}/events`, {
      method: "POST",
      token: apiToken,
      orgId,
      body: JSON.stringify({ name, venue: venue || null, start_date: startDate, end_date: endDate }),
    });
    if (!res.ok) {
      setError(`Failed to create event: ${res.status}`);
      return;
    }
    const event = await res.json();
    router.replace(`/org/${orgSlug}/events/${event.id}`);
  }

  return (
    <main className="mx-auto max-w-md">
      <PageHeader title="New event" />
      <Card>
        <CardContent className="pt-6">
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-1">
              <Label htmlFor="event-name">Name</Label>
              <Input id="event-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="event-venue">Venue</Label>
              <Input id="event-venue" value={venue} onChange={(e) => setVenue(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="event-start">Start date</Label>
                <Input
                  id="event-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="event-end">End date</Label>
                <Input id="event-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              </div>
            </div>
            <Button type="submit">Create event</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export default function NewEventPage() {
  return (
    <RoleGate allow={["organizer", "admin"]}>
      <NewEventPageContent />
    </RoleGate>
  );
}
