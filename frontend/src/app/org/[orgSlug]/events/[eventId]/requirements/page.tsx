"use client";

import { use, useEffect, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { RoleGate } from "@/components/RoleGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/apiClient";
import { useOrgContext } from "@/lib/org-context";
import type { EventContractRequirementsRead, RequirementField, RequirementFieldType } from "@/lib/types";

type EditableField = Omit<RequirementField, "options"> & { optionsText: string };

function toEditable(field: RequirementField): EditableField {
  return { ...field, optionsText: (field.options ?? []).join(", ") };
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
  return { key: "", label: "", field_type: "text", required: false, optionsText: "" };
}

function RequirementsPageContent({ eventId }: { eventId: string }) {
  const { orgId, apiToken } = useOrgContext();
  const [fields, setFields] = useState<EditableField[]>([]);
  const [message, setMessage] = useState<string | null>(null);

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

          {fields.map((field, i) => (
            <div key={i} className="space-y-3 rounded-md border p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Key</Label>
                  <Input
                    placeholder="shirt_size"
                    value={field.key}
                    onChange={(e) => updateField(i, { key: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Label</Label>
                  <Input
                    placeholder="Shirt size"
                    value={field.label}
                    onChange={(e) => updateField(i, { label: e.target.value })}
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
                  <Label>Options (comma-separated)</Label>
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
    <RoleGate allow={["organizer", "admin"]}>
      <RequirementsPageContent eventId={eventId} />
    </RoleGate>
  );
}
