"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function HomePage() {
  const { data: session, status } = useSession();

  return (
    <main>
      <h1>Dog Agility Judge Portal</h1>
      <p>Manage judging contracts and class allocations.</p>

      {status === "loading" && <p>Loading...</p>}

      {status === "unauthenticated" && (
        <div>
          <button onClick={() => signIn("google")}>Sign in with Google</button>
          <button onClick={() => signIn("facebook")}>Sign in with Facebook</button>
        </div>
      )}

      {status === "authenticated" && session?.user && (
        <div>
          <p>Signed in as {session.user.email}</p>
          <button onClick={() => signOut()}>Sign out</button>
        </div>
      )}
    </main>
  );
}
