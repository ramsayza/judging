import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrgContext } from "@/lib/org-context";
import type { MembershipRole } from "@/lib/types";

export function RoleGate({ allow, children }: { allow: MembershipRole[]; children: ReactNode }) {
  const { role } = useOrgContext();

  if (!allow.includes(role)) {
    return (
      <Card className="mx-auto mt-12 max-w-md">
        <CardHeader>
          <CardTitle>No access</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your role in this organization doesn&apos;t have access to this page.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
