"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/apiClient";
import { useOrgContext } from "@/lib/org-context";
import type { ContractRead } from "@/lib/types";

export default function ContractsListPage() {
  const { orgId, orgSlug, apiToken } = useOrgContext();
  const [contracts, setContracts] = useState<ContractRead[]>([]);

  useEffect(() => {
    apiFetch(`/api/v1/organizations/${orgId}/contracts`, { token: apiToken, orgId })
      .then((res) => res.json())
      .then(setContracts);
  }, [orgId, apiToken]);

  return (
    <main>
      <h1>Contracts</h1>
      <ul>
        {contracts.map((c) => (
          <li key={c.id}>
            <Link href={`/org/${orgSlug}/contracts/${c.id}`}>
              Event {c.event_id} — {c.status}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
