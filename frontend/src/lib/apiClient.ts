"use client";

import { useSession } from "next-auth/react";
import { useMemo } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function apiFetch(
  path: string,
  options: RequestInit & { token?: string; orgId?: string } = {}
): Promise<Response> {
  const { token, orgId, headers, ...rest } = options;
  const finalHeaders = new Headers(headers);
  if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  if (orgId) finalHeaders.set("X-Org-Id", orgId);
  if (rest.body && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }
  return fetch(`${API_BASE_URL}${path}`, { ...rest, headers: finalHeaders });
}

/** Client-component hook: returns a fetch function pre-bound to the signed-in
 * user's API token and the given org context. */
export function useApiClient(orgId?: string) {
  const { data: session } = useSession();
  return useMemo(() => {
    return (path: string, options: RequestInit = {}) =>
      apiFetch(path, { ...options, token: session?.apiToken, orgId });
  }, [session?.apiToken, orgId]);
}
