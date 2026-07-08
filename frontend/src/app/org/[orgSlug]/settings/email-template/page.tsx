"use client";

import { useEffect, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { RoleGate } from "@/components/RoleGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/apiClient";
import { useOrgContext } from "@/lib/org-context";
import type { OrganizationEmailTemplateRead } from "@/lib/types";

function EmailTemplateSettingsPageContent() {
  const { orgId, apiToken } = useOrgContext();
  const [template, setTemplate] = useState<OrganizationEmailTemplateRead | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/api/v1/organizations/${orgId}/email-template`, { token: apiToken, orgId })
      .then((res) => res.json())
      .then((data: OrganizationEmailTemplateRead) => {
        setTemplate(data);
        setSubject(data.effective_subject);
        setBody(data.effective_body);
      });
  }, [orgId, apiToken]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await apiFetch(`/api/v1/organizations/${orgId}/email-template`, {
      method: "PATCH",
      token: apiToken,
      orgId,
      body: JSON.stringify({ subject, body }),
    });
    if (!res.ok) {
      setMessage(`Failed to save: ${res.status}`);
      return;
    }
    const data: OrganizationEmailTemplateRead = await res.json();
    setTemplate(data);
    setMessage("Saved.");
  }

  async function resetToDefault() {
    setMessage(null);
    const res = await apiFetch(`/api/v1/organizations/${orgId}/email-template`, {
      method: "PATCH",
      token: apiToken,
      orgId,
      body: JSON.stringify({ subject: null, body: null }),
    });
    if (!res.ok) {
      setMessage(`Failed to reset: ${res.status}`);
      return;
    }
    const data: OrganizationEmailTemplateRead = await res.json();
    setTemplate(data);
    setSubject(data.effective_subject);
    setBody(data.effective_body);
    setMessage("Reset to default.");
  }

  if (!template) return <p className="p-8 text-sm text-muted-foreground">Loading...</p>;

  return (
    <main className="mx-auto max-w-2xl">
      <PageHeader
        title="Judge invitation email"
        description="Customize the email sent to judges when they're invited to an event."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && <p className="text-sm text-muted-foreground">{message}</p>}

          <form className="space-y-4" onSubmit={save}>
            <div className="space-y-1">
              <Label htmlFor="template-subject">Subject</Label>
              <Input id="template-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="template-body">Body</Label>
              <Textarea
                id="template-body"
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Available placeholders: {template.placeholders.map((p) => `{${p}}`).join(", ")}
            </div>
            <div className="flex gap-2">
              <Button type="submit">Save</Button>
              <Button type="button" variant="outline" onClick={resetToDefault}>
                Reset to default
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export default function EmailTemplateSettingsPage() {
  return (
    <RoleGate allow={["organizer"]}>
      <EmailTemplateSettingsPageContent />
    </RoleGate>
  );
}
