"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { GlobalNav } from "@/components/GlobalNav";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/apiClient";
import type { MyContractRead } from "@/lib/types";

export default function MyContractsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [contracts, setContracts] = useState<MyContractRead[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
  }, [status, router]);

  useEffect(() => {
    if (!session?.apiToken) return;
    apiFetch("/api/v1/me/contracts", { token: session.apiToken })
      .then((res) => res.json())
      .then(setContracts);
  }, [session?.apiToken]);

  if (status === "loading" || (status === "authenticated" && !session?.apiToken)) {
    return <p className="p-8 text-sm text-muted-foreground">Loading...</p>;
  }
  if (status !== "authenticated") return null;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <GlobalNav />
      <PageHeader title="Your contracts" description="Every judging contract you've been invited to, across all clubs." />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link className="font-medium hover:underline" href={`/contracts/${c.id}`}>
                  {c.event_name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{c.organization_name}</TableCell>
              <TableCell>
                <StatusBadge status={c.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {contracts.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          No contracts yet. Once a club invites you to judge an event, it'll show up here.
        </p>
      )}
    </main>
  );
}
