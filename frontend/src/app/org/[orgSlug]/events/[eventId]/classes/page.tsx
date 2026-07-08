"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { RoleGate } from "@/components/RoleGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/apiClient";
import { useOrgContext } from "@/lib/org-context";
import type { AllocationBoardEntry, EventClassRead, EventRead } from "@/lib/types";

interface ClassFormState {
  name: string;
  size: string;
  discipline: string;
  level: string;
  ring: string;
  ringPosition: string;
  classDate: string;
}

const EMPTY_FORM: ClassFormState = {
  name: "",
  size: "",
  discipline: "",
  level: "",
  ring: "",
  ringPosition: "",
  classDate: "",
};

const UNSCHEDULED = "Unscheduled";

function toBody(form: ClassFormState) {
  return {
    name: form.name,
    size: form.size || null,
    discipline: form.discipline || null,
    level: form.level || null,
    ring: form.ring || null,
    ring_position: form.ringPosition ? Number(form.ringPosition) : null,
    class_date: form.classDate || null,
  };
}

function fromClass(cls: EventClassRead): ClassFormState {
  return {
    name: cls.name,
    size: cls.size ?? "",
    discipline: cls.discipline ?? "",
    level: cls.level ?? "",
    ring: cls.ring ?? "",
    ringPosition: cls.ring_position === null ? "" : String(cls.ring_position),
    classDate: cls.class_date ?? "",
  };
}

function formatDayHeading(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function eventDateOptions(event: EventRead): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${event.start_date}T00:00:00`);
  const end = new Date(`${event.end_date}T00:00:00`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function groupByDay(classes: EventClassRead[]): { heading: string; classes: EventClassRead[] }[] {
  const groups = new Map<string, EventClassRead[]>();
  for (const cls of classes) {
    const key = cls.class_date ?? UNSCHEDULED;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(cls);
  }
  const dateKeys = Array.from(groups.keys())
    .filter((k) => k !== UNSCHEDULED)
    .sort();
  const orderedKeys = groups.has(UNSCHEDULED) ? [...dateKeys, UNSCHEDULED] : dateKeys;
  return orderedKeys.map((key) => ({
    heading: key === UNSCHEDULED ? UNSCHEDULED : formatDayHeading(key),
    classes: groups
      .get(key)!
      .sort(
        (a, b) =>
          (a.ring ?? "").localeCompare(b.ring ?? "") ||
          (a.ring_position ?? Infinity) - (b.ring_position ?? Infinity) ||
          (a.class_number ?? Infinity) - (b.class_number ?? Infinity)
      ),
  }));
}

function EventClassesPageContent({ eventId }: { eventId: string }) {
  const { orgId, orgSlug, role, apiToken } = useOrgContext();
  const canManage = role === "organizer";

  const [event, setEvent] = useState<EventRead | null>(null);
  const [classes, setClasses] = useState<EventClassRead[]>([]);
  const [board, setBoard] = useState<AllocationBoardEntry[]>([]);
  const [newClass, setNewClass] = useState<ClassFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ClassFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiFetch(`/api/v1/organizations/${orgId}/events/${eventId}`, { token: apiToken, orgId })
      .then((res) => res.json())
      .then(setEvent);
    apiFetch(`/api/v1/organizations/${orgId}/events/${eventId}/classes`, { token: apiToken, orgId })
      .then((res) => res.json())
      .then(setClasses);
    apiFetch(`/api/v1/organizations/${orgId}/events/${eventId}/allocations`, { token: apiToken, orgId })
      .then((res) => res.json())
      .then(setBoard);
  }, [orgId, apiToken, eventId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addClass(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await apiFetch(`/api/v1/organizations/${orgId}/events/${eventId}/classes`, {
      method: "POST",
      token: apiToken,
      orgId,
      body: JSON.stringify(toBody(newClass)),
    });
    if (!res.ok) {
      setError(`Failed to add class: ${res.status}`);
      return;
    }
    setNewClass(EMPTY_FORM);
    refresh();
  }

  function startEdit(cls: EventClassRead) {
    setEditingId(cls.id);
    setEditDraft(fromClass(cls));
  }

  async function saveEdit(classId: string) {
    setError(null);
    const res = await apiFetch(`/api/v1/organizations/${orgId}/events/${eventId}/classes/${classId}`, {
      method: "PATCH",
      token: apiToken,
      orgId,
      body: JSON.stringify(toBody(editDraft)),
    });
    if (!res.ok) {
      setError(`Failed to save class: ${res.status}`);
      return;
    }
    setEditingId(null);
    refresh();
  }

  async function deleteClass(classId: string) {
    setError(null);
    const res = await apiFetch(`/api/v1/organizations/${orgId}/events/${eventId}/classes/${classId}`, {
      method: "DELETE",
      token: apiToken,
      orgId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(`Failed to delete class: ${body?.detail ?? res.status}`);
      return;
    }
    refresh();
  }

  if (!event) return <p className="p-8 text-sm text-muted-foreground">Loading...</p>;

  const dayGroups = groupByDay(classes);
  const dateOptions = eventDateOptions(event);

  function renderRow(cls: EventClassRead) {
    const judgeNames = board
      .filter((b) => b.event_class_id === cls.id)
      .map((b) => b.judge_name)
      .join(", ");
    if (editingId === cls.id) {
      return (
        <TableRow key={cls.id}>
          <TableCell>{cls.class_number ?? "—"}</TableCell>
          <TableCell>
            <Input value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
          </TableCell>
          <TableCell>
            <Input
              className="w-28"
              value={editDraft.discipline}
              onChange={(e) => setEditDraft({ ...editDraft, discipline: e.target.value })}
            />
          </TableCell>
          <TableCell>
            <Input
              className="w-24"
              value={editDraft.size}
              onChange={(e) => setEditDraft({ ...editDraft, size: e.target.value })}
            />
          </TableCell>
          <TableCell>
            <Input
              className="w-28"
              value={editDraft.level}
              onChange={(e) => setEditDraft({ ...editDraft, level: e.target.value })}
            />
          </TableCell>
          <TableCell>
            <Input
              className="w-16"
              value={editDraft.ring}
              onChange={(e) => setEditDraft({ ...editDraft, ring: e.target.value })}
            />
          </TableCell>
          <TableCell>
            <Input
              className="w-16"
              type="number"
              value={editDraft.ringPosition}
              onChange={(e) => setEditDraft({ ...editDraft, ringPosition: e.target.value })}
            />
          </TableCell>
          <TableCell>
            <Select
              value={editDraft.classDate}
              onValueChange={(value) => setEditDraft({ ...editDraft, classDate: value })}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select date..." />
              </SelectTrigger>
              <SelectContent>
                {dateOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {formatDayHeading(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell className="text-sm text-muted-foreground">{judgeNames || "—"}</TableCell>
          <TableCell className="space-x-2 text-right">
            <Button size="sm" onClick={() => saveEdit(cls.id)}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
          </TableCell>
        </TableRow>
      );
    }
    return (
      <TableRow key={cls.id}>
        <TableCell>{cls.class_number ?? "—"}</TableCell>
        <TableCell className="font-medium">{cls.name}</TableCell>
        <TableCell>{cls.discipline ?? "—"}</TableCell>
        <TableCell>{cls.size ?? "—"}</TableCell>
        <TableCell>{cls.level ?? "—"}</TableCell>
        <TableCell>{cls.ring ?? "—"}</TableCell>
        <TableCell>{cls.ring_position ?? "—"}</TableCell>
        <TableCell>{cls.class_date ?? "—"}</TableCell>
        <TableCell className="text-sm text-muted-foreground">{judgeNames || "—"}</TableCell>
        {canManage && (
          <TableCell className="space-x-2 text-right">
            <Button size="sm" variant="outline" onClick={() => startEdit(cls)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => deleteClass(cls.id)}>
              Delete
            </Button>
          </TableCell>
        )}
      </TableRow>
    );
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title={`Classes — ${event.name}`}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/org/${orgSlug}/events/${eventId}`}>Back to event</Link>
          </Button>
        }
      />
      {error && <p className="text-sm text-destructive">{error}</p>}

      {dayGroups.map(({ heading, classes: dayClasses }) => (
        <Card key={heading}>
          <CardHeader>
            <CardTitle className="text-lg">{heading}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Discipline</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Ring</TableHead>
                  <TableHead>Ring order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Judges</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>{dayClasses.map(renderRow)}</TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
      {classes.length === 0 && <p className="text-sm text-muted-foreground">No classes yet.</p>}

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add class</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid grid-cols-2 gap-4 md:grid-cols-4" onSubmit={addClass}>
              <div className="col-span-2 space-y-1 md:col-span-1">
                <Label htmlFor="class-name">Name</Label>
                <Input
                  id="class-name"
                  value={newClass.name}
                  onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="class-discipline">Discipline</Label>
                <Input
                  id="class-discipline"
                  placeholder="Agility, Jumping..."
                  value={newClass.discipline}
                  onChange={(e) => setNewClass({ ...newClass, discipline: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="class-size">Size</Label>
                <Input
                  id="class-size"
                  placeholder="Large, Medium..."
                  value={newClass.size}
                  onChange={(e) => setNewClass({ ...newClass, size: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="class-level">Level / Grade</Label>
                <Input
                  id="class-level"
                  placeholder="Grades 1-2..."
                  value={newClass.level}
                  onChange={(e) => setNewClass({ ...newClass, level: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="class-ring">Ring</Label>
                <Input
                  id="class-ring"
                  value={newClass.ring}
                  onChange={(e) => setNewClass({ ...newClass, ring: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="class-ring-position">Ring order</Label>
                <Input
                  id="class-ring-position"
                  type="number"
                  placeholder="1st, 2nd..."
                  value={newClass.ringPosition}
                  onChange={(e) => setNewClass({ ...newClass, ringPosition: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="class-date">Date</Label>
                <Select
                  value={newClass.classDate}
                  onValueChange={(value) => setNewClass({ ...newClass, classDate: value })}
                >
                  <SelectTrigger id="class-date">
                    <SelectValue placeholder="Select date..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dateOptions.map((d) => (
                      <SelectItem key={d} value={d}>
                        {formatDayHeading(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex items-end md:col-span-4">
                <Button type="submit">Add class</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

export default function EventClassesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  return (
    <RoleGate allow={["organizer"]}>
      <EventClassesPageContent eventId={eventId} />
    </RoleGate>
  );
}
