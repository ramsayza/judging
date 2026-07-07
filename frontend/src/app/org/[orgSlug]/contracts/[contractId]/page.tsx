"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";

import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiClient";
import { useOrgContext } from "@/lib/org-context";
import type { ContractRead, EventContractRequirementsRead, EventRead, RequirementField } from "@/lib/types";

const LIFECYCLE_STEPS: { status: string; label: string }[] = [
  { status: "invitation", label: "Invited" },
  { status: "accepted", label: "Accepted" },
  { status: "appointed", label: "Appointed" },
  { status: "complete", label: "Complete" },
];

function hasValue(value: string | string[] | undefined): boolean {
  if (value === undefined) return false;
  return Array.isArray(value) ? value.length > 0 : value !== "";
}

export default function ContractDetailPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = use(params);
  const { orgId, apiToken, role } = useOrgContext();
  const [contract, setContract] = useState<ContractRead | null>(null);
  const [event, setEvent] = useState<EventRead | null>(null);
  const [requirementFields, setRequirementFields] = useState<RequirementField[]>([]);
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canManage = role === "organizer" || role === "admin";

  const refresh = useCallback(() => {
    apiFetch(`/api/v1/organizations/${orgId}/contracts/${contractId}`, { token: apiToken, orgId })
      .then((res) => res.json())
      .then(setContract);
  }, [orgId, apiToken, contractId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!contract) return;
    apiFetch(`/api/v1/organizations/${orgId}/events/${contract.event_id}`, { token: apiToken, orgId })
      .then((res) => res.json())
      .then(setEvent);
    apiFetch(`/api/v1/organizations/${orgId}/events/${contract.event_id}/contract-requirements`, {
      token: apiToken,
      orgId,
    })
      .then((res) => res.json())
      .then((data: EventContractRequirementsRead) => setRequirementFields(data.fields));
  }, [orgId, apiToken, contract]);

  function updateResponse(key: string, value: string) {
    setResponses((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMultiselectOption(key: string, option: string) {
    setResponses((prev) => {
      const current = (prev[key] as string[] | undefined) ?? [];
      const next = current.includes(option) ? current.filter((o) => o !== option) : [...current, option];
      return { ...prev, [key]: next };
    });
  }

  async function act(action: "decline" | "appoint" | "complete" | "cancel") {
    setError(null);
    const res = await apiFetch(`/api/v1/organizations/${orgId}/contracts/${contractId}/${action}`, {
      method: "POST",
      token: apiToken,
      orgId,
      body: JSON.stringify({ reason: reason || undefined }),
    });
    if (!res.ok) {
      setError(`Failed to ${action}: ${res.status}`);
      return;
    }
    refresh();
  }

  async function accept() {
    setError(null);
    const res = await apiFetch(`/api/v1/organizations/${orgId}/contracts/${contractId}/accept`, {
      method: "POST",
      token: apiToken,
      orgId,
      body: JSON.stringify({ responses }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(`Failed to accept: ${body?.detail ?? res.status}`);
      return;
    }
    refresh();
  }

  if (!contract) return <p className="p-8 text-sm text-muted-foreground">Loading...</p>;

  const isTerminalOffPath = contract.status === "declined" || contract.status === "cancelled";
  const currentIndex = LIFECYCLE_STEPS.findIndex((s) => s.status === contract.status);
  const canAccept = requirementFields.every((f) => !f.required || hasValue(responses[f.key]));

  return (
    <main className="mx-auto max-w-xl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{event ? event.name : `Contract for event ${contract.event_id}`}</CardTitle>
            <p className="text-sm text-muted-foreground">Judge: {contract.judge_name}</p>
            {event && (
              <p className="mt-1 text-sm text-muted-foreground">
                {event.venue ?? "No venue set"} — {event.start_date} to {event.end_date}
              </p>
            )}
          </div>
          <StatusBadge status={contract.status} />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className={cn("flex items-center justify-between", isTerminalOffPath && "opacity-40")}>
            {LIFECYCLE_STEPS.map((step, i) => {
              const done = !isTerminalOffPath && currentIndex >= 0 && i <= currentIndex;
              const isCurrent = !isTerminalOffPath && i === currentIndex;
              return (
                <div key={step.status} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border text-xs",
                      done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-muted-foreground",
                      isCurrent && "ring-2 ring-primary ring-offset-2"
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className="text-center text-xs text-muted-foreground">{step.label}</span>
                </div>
              );
            })}
          </div>

          {contract.decline_reason && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Decline reason: {contract.decline_reason}
            </p>
          )}
          {contract.cancel_reason && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Cancel reason: {contract.cancel_reason}
            </p>
          )}

          {contract.requirement_responses && (
            <div className="space-y-2 rounded-md border p-4">
              <p className="text-sm font-medium">Judging requirements</p>
              {requirementFields.map((f) => {
                const value = contract.requirement_responses?.[f.key];
                if (value === undefined) return null;
                return (
                  <p key={f.key} className="text-sm text-muted-foreground">
                    <span className="text-foreground">{f.label}:</span>{" "}
                    {Array.isArray(value) ? value.join(", ") : value}
                  </p>
                );
              })}
            </div>
          )}

          {contract.status === "invitation" && requirementFields.length > 0 && (
            <div className="space-y-3 rounded-md border p-4">
              <p className="text-sm font-medium">Judging requirements</p>
              {requirementFields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label>
                    {f.label}
                    {f.required && " *"}
                  </Label>
                  {(f.field_type === "text" || f.field_type === "number") && (
                    <Input
                      type={f.field_type === "number" ? "number" : "text"}
                      value={(responses[f.key] as string) ?? ""}
                      onChange={(e) => updateResponse(f.key, e.target.value)}
                    />
                  )}
                  {f.field_type === "select" && (
                    <Select
                      value={(responses[f.key] as string) ?? ""}
                      onValueChange={(value) => updateResponse(f.key, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(f.options ?? []).map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {f.field_type === "multiselect" && (
                    <div className="flex flex-wrap gap-3">
                      {(f.options ?? []).map((option) => {
                        const selected = ((responses[f.key] as string[]) ?? []).includes(option);
                        return (
                          <label key={option} className="flex items-center gap-1.5 text-sm">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={selected}
                              onChange={() => toggleMultiselectOption(f.key, option)}
                            />
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Separator />

          <div className="flex flex-wrap items-center gap-2">
            {contract.status === "invitation" && (
              <>
                <Button disabled={!canAccept} onClick={accept}>
                  Accept
                </Button>
                <Input
                  className="max-w-xs"
                  placeholder="Decline reason (optional)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <Button variant="destructive" onClick={() => act("decline")}>
                  Decline
                </Button>
              </>
            )}

            {canManage && contract.status === "accepted" && <Button onClick={() => act("appoint")}>Appoint</Button>}
            {canManage && contract.status === "appointed" && <Button onClick={() => act("complete")}>Complete</Button>}
            {canManage && ["invitation", "accepted", "appointed"].includes(contract.status) && (
              <Button variant="destructive" onClick={() => act("cancel")}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
