"use client";

import { use, useEffect, useState } from "react";
import { Info } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { RoleGate } from "@/components/RoleGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { apiFetch } from "@/lib/apiClient";
import { toFieldKey } from "@/lib/utils";
import { useOrgContext } from "@/lib/org-context";
import type { EventContractRequirementsRead, RequirementField, RequirementFieldType } from "@/lib/types";

type EditableField = Omit<RequirementField, "options"> & { optionsText: string; keyManuallyEdited: boolean };

function toEditable(field: RequirementField): EditableField {
  // Loaded from the server -- already has a stable key. Don't let a later
  // label tweak silently rewrite it (already-accepted contracts' stored
  // responses are keyed by it).
  return { ...field, optionsText: (field.options ?? []).join(", "), keyManuallyEdited: true };
}

function toRequirementField(field: EditableField): RequirementField {
  const needsOptions = field.field_type === "select" || field.field_type === "multiselect";
  const options = needsOptions
    ? field.optionsText
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : null;
  return { key: field.key, label: field.label, field_type: field.field_type, required: field.required, options };
}

function blankField(): EditableField {
  return { key: "", label: "", field_type: "text", required: false, optionsText: "", keyManuallyEdited: false };
}

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

function validateFields(fields: EditableField[]): string[] {
  const errors: string[] = [];
  const seenKeys = new Set<string>();

  fields.forEach((f, i) => {
    const label = f.label.trim() || `Field ${i + 1}`;
    if (!f.label.trim()) errors.push(`${label}: label is required.`);
    if (!KEY_PATTERN.test(f.key)) {
      errors.push(`${label}: key must start with a lowercase letter and contain only lowercase letters, numbers, and underscores.`);
    } else if (seenKeys.has(f.key)) {
      errors.push(`${label}: key "${f.key}" is used by more than one field.`);
    }
    seenKeys.add(f.key);

    if (f.field_type === "select" || f.field_type === "multiselect") {
      const options = f.optionsText
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      if (options.length === 0) errors.push(`${label}: select/multi-select fields need at least one option.`);
    }
  });

  return errors;
}

function RequirementsPageContent({ eventId }: { eventId: string }) {
  const { orgId, apiToken } = useOrgContext();
  const [fields, setFields] = useState<EditableField[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    apiFetch(`/api/v1/organizations/${orgId}/events/${eventId}/contract-requirements`, { token: apiToken, orgId })
      .then((res) => res.json())
      .then((data: EventContractRequirementsRead) => setFields(data.fields.map(toEditable)));
  }, [orgId, apiToken, eventId]);

  function updateField(index: number, patch: Partial<EditableField>) {
    setFields(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeField(index: number) {
    setFields(fields.filter((_, i) => i !== index));
  }

  async function save() {
    setMessage(null);
    const validationErrors = validateFields(fields);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    const res = await apiFetch(`/api/v1/organizations/${orgId}/events/${eventId}/contract-requirements`, {
      method: "PATCH",
      token: apiToken,
      orgId,
      body: JSON.stringify({ fields: fields.map(toRequirementField) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setMessage(`Failed to save: ${body?.detail ?? res.status}`);
      return;
    }
    const data: EventContractRequirementsRead = await res.json();
    setFields(data.fields.map(toEditable));
    setMessage("Saved.");
  }

  return (
    <main className="mx-auto max-w-2xl">
      <PageHeader
        title="Judging requirements"
        description="Custom fields a judge must fill in when accepting a contract for this event."
      />
      <Card>
        <CardContent className="space-y-4 pt-6">
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          {errors.length > 0 && (
            <div className="space-y-1 rounded-md border border-destructive/50 bg-destructive/10 p-3">
              {errors.map((err, i) => (
                <p key={i} className="text-sm text-destructive">
                  {err}
                </p>
              ))}
            </div>
          )}

          {fields.map((field, i) => (
            <div key={i} className="space-y-3 rounded-md border p-4">
              <div className="space-y-1">
                <Label className="text-base">Field label</Label>
                <Input
                  className="text-base font-medium"
                  placeholder="Shirt size"
                  value={field.label}
                  onChange={(e) => {
                    const nextLabel = e.target.value;
                    updateField(i, {
                      label: nextLabel,
                      key: field.keyManuallyEdited ? field.key : toFieldKey(nextLabel),
                    });
                  }}
                />
                <div className="flex items-center gap-1 pt-1">
                  <span className="text-xs text-muted-foreground">Key</span>
                  <Tooltip>
                    <TooltipTrigger type="button">
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Internal identifier used to store this field&apos;s answer — auto-filled from the label,
                      edit only if you need a specific value.
                    </TooltipContent>
                  </Tooltip>
                  <Input
                    className="h-7 max-w-[220px] text-xs text-muted-foreground"
                    placeholder="shirt_size"
                    value={field.key}
                    onChange={(e) => updateField(i, { key: e.target.value, keyManuallyEdited: true })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select
                    value={field.field_type}
                    onValueChange={(value) => updateField(i, { field_type: value as RequirementFieldType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="select">Single select</SelectItem>
                      <SelectItem value="multiselect">Multi-select</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2 pb-2">
                  <input
                    id={`required-${i}`}
                    type="checkbox"
                    className="h-4 w-4"
                    checked={field.required}
                    onChange={(e) => updateField(i, { required: e.target.checked })}
                  />
                  <Label htmlFor={`required-${i}`}>Required</Label>
                </div>
              </div>

              {(field.field_type === "select" || field.field_type === "multiselect") && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label>Options (comma-separated)</Label>
                    <Tooltip>
                      <TooltipTrigger type="button">
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Comma-separated list of choices the judge can pick from, e.g. S, M, L, XL.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    placeholder="S, M, L, XL"
                    value={field.optionsText}
                    onChange={(e) => updateField(i, { optionsText: e.target.value })}
                  />
                </div>
              )}

              <Button size="sm" variant="destructive" onClick={() => removeField(i)}>
                Remove field
              </Button>
            </div>
          ))}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setFields([...fields, blankField()])}>
              + Add field
            </Button>
            <Button onClick={save}>Save</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default function RequirementsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  return (
    <RoleGate allow={["organizer"]}>
      <RequirementsPageContent eventId={eventId} />
    </RoleGate>
  );
}
