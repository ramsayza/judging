"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useState } from "react";

const IS_DEV_ENVIRONMENT = process.env.NEXT_PUBLIC_ENVIRONMENT === "development";

export default function HomePage() {
  const { data: session, status } = useSession();
  const [devEmail, setDevEmail] = useState("");
  const [devName, setDevName] = useState("");

  return (
    <main>
      <h1>Dog Agility Judge Portal</h1>
      <p>Manage judging contracts and class allocations.</p>

      {status === "loading" && <p>Loading...</p>}

      {status === "unauthenticated" && (
        <div>
          <button onClick={() => signIn("google")}>Sign in with Google</button>
          <button onClick={() => signIn("facebook")}>Sign in with Facebook</button>

          {IS_DEV_ENVIRONMENT && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                signIn("dev", { email: devEmail, name: devName });
              }}
            >
              <h2>Dev login (development only)</h2>
              <input placeholder="email" value={devEmail} onChange={(e) => setDevEmail(e.target.value)} required />
              <input placeholder="name" value={devName} onChange={(e) => setDevName(e.target.value)} />
              <button type="submit">Dev sign in</button>
            </form>
          )}
        </div>
      )}

      {status === "authenticated" && session?.user && (
        <div>
          <p>Signed in as {session.user.email}</p>
          <Link href="/onboarding">Go to your organizations</Link>
          <button onClick={() => signOut()}>Sign out</button>
        </div>
      )}
    </main>
  );
}
