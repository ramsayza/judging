"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";

import { GlobalNav } from "@/components/GlobalNav";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiClient";
import type {
  ContractCopyRead,
  EventContractRequirementsRead,
  MyContractRead,
  ReimbursementEstimate,
  RequirementField,
} from "@/lib/types";

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

export default function MyContractDetailPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = use(params);
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const apiToken = session?.apiToken;

  const [contract, setContract] = useState<MyContractRead | null>(null);
  const [requirementFields, setRequirementFields] = useState<RequirementField[]>([]);
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reimbursementEstimate, setReimbursementEstimate] = useState<ReimbursementEstimate | null>(null);
  const [reimbursementError, setReimbursementError] = useState<string | null>(null);
  const [contractCopy, setContractCopy] = useState<ContractCopyRead | null>(null);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") router.replace("/");
  }, [sessionStatus, router]);

  const refresh = useCallback(() => {
    if (!apiToken) return;
    apiFetch(`/api/v1/me/contracts/${contractId}`, { token: apiToken })
      .then((res) => res.json())
      .then(setContract);
  }, [apiToken, contractId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!contract || !apiToken) return;
    apiFetch(`/api/v1/organizations/${contract.organization_id}/events/${contract.event_id}/contract-requirements`, {
      token: apiToken,
      orgId: contract.organization_id,
    })
      .then((res) => res.json())
      .then((data: EventContractRequirementsRead) => setRequirementFields(data.fields));
  }, [apiToken, contract]);

  useEffect(() => {
    if (!contract || !apiToken || contract.status !== "invitation") return;
    setReimbursementError(null);
    apiFetch(`/api/v1/organizations/${contract.organization_id}/contracts/${contractId}/reimbursement-estimate`, {
      token: apiToken,
      orgId: contract.organization_id,
    }).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setReimbursementError(body?.detail ?? "Couldn't calculate an expense estimate right now.");
        return;
      }
      setReimbursementEstimate(await res.json());
    });
  }, [apiToken, contract, contractId]);

  useEffect(() => {
    if (!contract || !apiToken || contract.status !== "accepted") return;
    apiFetch(`/api/v1/organizations/${contract.organization_id}/contracts/${contractId}/contract-copy`, {
      token: apiToken,
      orgId: contract.organization_id,
    })
      .then((res) => res.json())
      .then(setContractCopy);
  }, [apiToken, contract, contractId]);

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

  async function decline() {
    if (!contract || !apiToken) return;
    setError(null);
    const res = await apiFetch(`/api/v1/organizations/${contract.organization_id}/contracts/${contractId}/decline`, {
      method: "POST",
      token: apiToken,
      orgId: contract.organization_id,
      body: JSON.stringify({ reason: reason || undefined }),
    });
    if (!res.ok) {
      setError(`Failed to decline: ${res.status}`);
      return;
    }
    refresh();
  }

  async function signContractCopy() {
    if (!contract || !apiToken) return;
    setError(null);
    const res = await apiFetch(
      `/api/v1/organizations/${contract.organization_id}/contracts/${contractId}/sign-contract-copy`,
      { method: "POST", token: apiToken, orgId: contract.organization_id }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(`Failed to sign: ${body?.detail ?? res.status}`);
      return;
    }
    refresh();
  }

  async function accept() {
    if (!contract || !apiToken) return;
    setError(null);
    const res = await apiFetch(`/api/v1/organizations/${contract.organization_id}/contracts/${contractId}/accept`, {
      method: "POST",
      token: apiToken,
      orgId: contract.organization_id,
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
    <main className="mx-auto max-w-xl p-6">
      <GlobalNav />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>
              {contract.event_name}{" "}
              <span className="font-normal text-muted-foreground">— {contract.organization_name}</span>
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {contract.venue ?? "No venue set"} — {contract.event_start_date} to {contract.event_end_date}
            </p>
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

          {contract.reimbursement_estimate && (
            <div className="rounded-md border p-4 text-sm">
              <p className="font-medium">Reimbursement (at acceptance)</p>
              <p className="text-muted-foreground">
                £{contract.reimbursement_estimate.amount} for an estimated{" "}
                {contract.reimbursement_estimate.miles_return} miles return (£
                {contract.reimbursement_estimate.rate_per_mile}/mile
                {contract.reimbursement_estimate.cap ? ", capped" : ""})
              </p>
            </div>
          )}

          {contract.status === "invitation" && (
            <div className="rounded-md border p-4 text-sm">
              <p className="font-medium">Estimated expenses</p>
              {reimbursementEstimate && (
                <p className="text-muted-foreground">
                  £{reimbursementEstimate.amount} for an estimated {reimbursementEstimate.miles_return} miles return
                  (£{reimbursementEstimate.rate_per_mile}/mile{reimbursementEstimate.cap ? ", capped" : ""}) — straight-line
                  estimate, not exact road mileage.
                </p>
              )}
              {reimbursementError && (
                <p className="text-muted-foreground">
                  {reimbursementError}
                  {reimbursementError.includes("home postcode") && (
                    <>
                      {" "}
                      <Link href="/profile" className="underline">
                        Set it in Your Details
                      </Link>
                      .
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          {contract.contract_copy_signed_at && (
            <div className="space-y-2 rounded-md border p-4">
              <p className="text-sm font-medium">
                Contract signed on {new Date(contract.contract_copy_signed_at).toLocaleDateString()}
              </p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {contract.contract_copy_signed_body}
              </p>
            </div>
          )}

          {contract.status === "accepted" && !contract.contract_copy_signed_at && contractCopy?.effective_body && (
            <div className="space-y-3 rounded-md border p-4">
              <p className="text-sm font-medium">Contract to sign</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{contractCopy.effective_body}</p>
              <Button size="sm" onClick={signContractCopy}>
                Sign contract
              </Button>
            </div>
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

          {contract.status === "invitation" && (
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={!canAccept} onClick={accept}>
                Accept
              </Button>
              <Input
                className="max-w-xs"
                placeholder="Decline reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button variant="destructive" onClick={decline}>
                Decline
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
