"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/apiClient";
import { useOrgContext } from "@/lib/org-context";
import type { MembershipRole, MembershipWithUserRead } from "@/lib/types";

export default function MembersPage() {
  const { orgId, role, apiToken } = useOrgContext();
  const [members, setMembers] = useState<MembershipWithUserRead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = role === "admin";

  const refresh = useCallback(() => {
    apiFetch(`/api/v1/organizations/${orgId}/memberships`, { token: apiToken, orgId })
      .then((res) => res.json())
      .then(setMembers);
  }, [orgId, apiToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function approve(membershipId: string) {
    await updateMembership(membershipId, { status: "active" });
  }

  async function setRole(membershipId: string, newRole: MembershipRole) {
    await updateMembership(membershipId, { role: newRole });
  }

  async function remove(membershipId: string) {
    await updateMembership(membershipId, { status: "removed" });
  }

  async function updateMembership(membershipId: string, body: Record<string, string>) {
    setError(null);
    const res = await apiFetch(`/api/v1/organizations/${orgId}/memberships/${membershipId}`, {
      method: "PATCH",
      token: apiToken,
      orgId,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError(`Failed to update membership: ${res.status}`);
      return;
    }
    refresh();
  }

  const pending = members.filter((m) => m.status === "pending");
  const active = members.filter((m) => m.status === "active");

  return (
    <main>
      <h1>Members</h1>
      {error && <p>{error}</p>}

      {isAdmin && (
        <section>
          <h2>Pending approval</h2>
          {pending.length === 0 && <p>No pending requests.</p>}
          <ul>
            {pending.map((m) => (
              <li key={m.id}>
                {m.user_name} ({m.user_email}) <button onClick={() => approve(m.id)}>Approve</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>Active members</h2>
        <ul>
          {active.map((m) => (
            <li key={m.id}>
              {m.user_name} ({m.user_email}) — {m.role}
              {isAdmin && (
                <>
                  <select value={m.role} onChange={(e) => setRole(m.id, e.target.value as MembershipRole)}>
                    <option value="judge">judge</option>
                    <option value="organizer">organizer</option>
                    <option value="admin">admin</option>
                  </select>
                  <button onClick={() => remove(m.id)}>Remove</button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
