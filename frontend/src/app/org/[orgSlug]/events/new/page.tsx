"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/apiClient";
import { useOrgContext } from "@/lib/org-context";

export default function NewEventPage() {
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
    <main>
      <h1>New event</h1>
      {error && <p>{error}</p>}
      <form onSubmit={submit}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Venue
          <input value={venue} onChange={(e) => setVenue(e.target.value)} />
        </label>
        <label>
          Start date
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </label>
        <label>
          End date
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </label>
        <button type="submit">Create event</button>
      </form>
    </main>
  );
}
