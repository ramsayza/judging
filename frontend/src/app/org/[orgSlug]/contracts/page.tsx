"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
      <PageHeader title="Contracts" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Judge</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link className="font-medium hover:underline" href={`/org/${orgSlug}/contracts/${c.id}`}>
                  Event {c.event_id}
                </Link>
              </TableCell>
              <TableCell>
                {c.judge_name}
                <div className="text-xs text-muted-foreground">{c.judge_email}</div>
              </TableCell>
              <TableCell>
                <StatusBadge status={c.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {contracts.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No contracts yet.</p>}
    </main>
  );
}
