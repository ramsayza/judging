"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { use, type ReactNode } from "react";

import { OrgProvider } from "@/lib/org-context";

export default function OrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);

  return (
    <OrgProvider orgSlug={orgSlug}>
      <nav style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <Link href={`/org/${orgSlug}/dashboard`}>Dashboard</Link>
        <Link href={`/org/${orgSlug}/events`}>Events</Link>
        <Link href={`/org/${orgSlug}/contracts`}>Contracts</Link>
        <Link href={`/org/${orgSlug}/members`}>Members</Link>
        <button onClick={() => signOut()}>Sign out</button>
      </nav>
      {children}
    </OrgProvider>
  );
}
