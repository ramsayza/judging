"use client";

import { use, type ReactNode } from "react";

import { OrgNav } from "@/components/org/OrgNav";
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
      <div className="mx-auto max-w-5xl p-6">
        <OrgNav orgSlug={orgSlug} />
        {children}
      </div>
    </OrgProvider>
  );
}
