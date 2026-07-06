"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/apiClient";
import type { OrganizationPublicRead } from "@/lib/types";

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [orgs, setOrgs] = useState<OrganizationPublicRead[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
  }, [status, router]);

  useEffect(() => {
    if (!session?.apiToken) return;
    apiFetch("/api/v1/organizations", { token: session.apiToken })
      .then((res) => res.json())
      .then(setOrgs);
  }, [session?.apiToken]);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await apiFetch("/api/v1/onboarding/organizations", {
      method: "POST",
      token: session?.apiToken,
      body: JSON.stringify({ name, slug }),
    });
    if (!res.ok) {
      setMessage(`Failed to create organization: ${res.status}`);
      return;
    }
    const org = await res.json();
    router.replace(`/org/${org.slug}/dashboard`);
  }

  async function joinOrg(org: OrganizationPublicRead) {
    setMessage(null);
    const res = await apiFetch(`/api/v1/onboarding/organizations/${org.id}/join`, {
      method: "POST",
      token: session?.apiToken,
    });
    if (!res.ok) {
      setMessage(`Failed to join organization: ${res.status}`);
      return;
    }
    router.replace(`/org/${org.slug}/dashboard`);
  }

  if (status === "loading" || (status === "authenticated" && !session?.apiToken)) {
    return <p>Loading...</p>;
  }
  if (status !== "authenticated") {
    return null;
  }

  return (
    <main>
      <h1>Welcome</h1>
      {message && <p>{message}</p>}

      <section>
        <h2>Create a new organization</h2>
        <form onSubmit={createOrg}>
          <input placeholder="Organization name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input
            placeholder="url-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
            required
          />
          <button type="submit">Create organization</button>
        </form>
      </section>

      <section>
        <h2>Join an existing organization</h2>
        <ul>
          {orgs.map((org) => (
            <li key={org.id}>
              {org.name}{" "}
              <button onClick={() => joinOrg(org)}>Join</button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
