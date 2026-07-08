"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { RoleGate } from "@/components/RoleGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/apiClient";
import { useOrgContext } from "@/lib/org-context";
import type { EventRead, EventRuleSet, EventStatus } from "@/lib/types";

const RULE_SETS: EventRuleSet[] = ["RKC", "Nexus", "IFCS", "A4A", "Independent"];
const STATUSES: EventStatus[] = ["draft", "published", "completed", "cancelled", "archived"];

function EditEventPageContent({ eventId }: { eventId: string }) {
  const { orgId, orgSlug, apiToken } = useOrgContext();
  const router = useRouter();

  const [event, setEvent] = useState<EventRead | null>(null);
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [venuePostcode, setVenuePostcode] = useState("");
  const [ruleSet, setRuleSet] = useState<EventRuleSet | "">("");
  const [costPerMile, setCostPerMile] = useState("0.55");
  const [reimbursementCap, setReimbursementCap] = useState("");
  const [contractCopyOverride, setContractCopyOverride] = useState("");
  const [eventStatus, setEventStatus] = useState<EventStatus>("draft");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/api/v1/organizations/${orgId}/events/${eventId}`, { token: apiToken, orgId })
      .then((res) => res.json())
      .then((data: EventRead) => {
        setEvent(data);
        setName(data.name);
        setVenue(data.venue ?? "");
        setVenuePostcode(data.venue_postcode ?? "");
        setRuleSet(data.rule_set ?? "");
        setCostPerMile(String(data.cost_per_mile));
        setReimbursementCap(data.reimbursement_cap === null ? "" : String(data.reimbursement_cap));
        setContractCopyOverride(data.contract_copy_override ?? "");
        setEventStatus(data.status);
        setStartDate(data.start_date);
        setEndDate(data.end_date);
      });
  }, [orgId, apiToken, eventId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await apiFetch(`/api/v1/organizations/${orgId}/events/${eventId}`, {
      method: "PATCH",
      token: apiToken,
      orgId,
      body: JSON.stringify({
        name,
        venue: venue || null,
        venue_postcode: venuePostcode || null,
        rule_set: ruleSet || null,
        cost_per_mile: costPerMile,
        reimbursement_cap: reimbursementCap || null,
        contract_copy_override: contractCopyOverride || null,
        start_date: startDate,
        end_date: endDate,
        status: eventStatus,
      }),
    });
    if (!res.ok) {
      setError(`Failed to save: ${res.status}`);
      return;
    }
    router.replace(`/org/${orgSlug}/events/${eventId}`);
  }

  if (!event) return <p className="p-8 text-sm text-muted-foreground">Loading...</p>;

  return (
    <main className="mx-auto max-w-md">
      <PageHeader title="Edit event" />
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
                <Label htmlFor="event-venue-postcode">Venue postcode</Label>
                <Input
                  id="event-venue-postcode"
                  value={venuePostcode}
                  onChange={(e) => setVenuePostcode(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="event-rule-set">Rule set</Label>
                <Select value={ruleSet} onValueChange={(value) => setRuleSet(value as EventRuleSet)} required>
                  <SelectTrigger id="event-rule-set">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_SETS.map((rs) => (
                      <SelectItem key={rs} value={rs}>
                        {rs}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="event-cost-per-mile">Cost per mile (£)</Label>
                <Input
                  id="event-cost-per-mile"
                  type="number"
                  step="0.01"
                  value={costPerMile}
                  onChange={(e) => setCostPerMile(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="event-reimbursement-cap">Reimbursement cap (£, optional)</Label>
                <Input
                  id="event-reimbursement-cap"
                  type="number"
                  step="0.01"
                  value={reimbursementCap}
                  onChange={(e) => setReimbursementCap(e.target.value)}
                />
              </div>
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
            <div className="space-y-1">
              <Label htmlFor="event-contract-copy">Contract copy override (optional)</Label>
              <Textarea
                id="event-contract-copy"
                rows={5}
                placeholder="Leave blank to use the club's usual contract for this rule set."
                value={contractCopyOverride}
                onChange={(e) => setContractCopyOverride(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="event-status">Status</Label>
              <Select value={eventStatus} onValueChange={(value) => setEventStatus(value as EventStatus)}>
                <SelectTrigger id="event-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export default function EditEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  return (
    <RoleGate allow={["organizer"]}>
      <EditEventPageContent eventId={eventId} />
    </RoleGate>
  );
}
