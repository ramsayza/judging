"use client";

import { use, useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/apiClient";
import { useOrgContext } from "@/lib/org-context";
import type { ContractRead } from "@/lib/types";

export default function ContractDetailPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = use(params);
  const { orgId, apiToken, role } = useOrgContext();
  const [contract, setContract] = useState<ContractRead | null>(null);
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

  async function act(action: "accept" | "decline" | "appoint" | "complete" | "cancel") {
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

  if (!contract) return <p>Loading...</p>;

  return (
    <main>
      <h1>Contract for event {contract.event_id}</h1>
      <p>Status: {contract.status}</p>
      {contract.decline_reason && <p>Decline reason: {contract.decline_reason}</p>}
      {contract.cancel_reason && <p>Cancel reason: {contract.cancel_reason}</p>}
      {error && <p>{error}</p>}

      {contract.status === "invitation" && (
        <div>
          <button onClick={() => act("accept")}>Accept</button>
          <input placeholder="Decline reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button onClick={() => act("decline")}>Decline</button>
        </div>
      )}

      {canManage && contract.status === "accepted" && <button onClick={() => act("appoint")}>Appoint</button>}
      {canManage && contract.status === "appointed" && <button onClick={() => act("complete")}>Complete</button>}
      {canManage && ["invitation", "accepted", "appointed"].includes(contract.status) && (
        <button onClick={() => act("cancel")}>Cancel</button>
      )}
    </main>
  );
}
