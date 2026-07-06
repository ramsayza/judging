import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import FacebookProvider from "next-auth/providers/facebook";
import GoogleProvider from "next-auth/providers/google";
import { SignJWT } from "jose";

const IS_DEV_ENVIRONMENT = process.env.ENVIRONMENT === "development";

// Server-to-server calls (NextAuth callbacks run on the Next.js server) go to the
// backend's internal docker-network address. Browser calls use NEXT_PUBLIC_API_BASE_URL
// instead -- see apiClient.ts.
const INTERNAL_API_BASE_URL = process.env.API_INTERNAL_URL || "http://backend:8000";

const BACKEND_JWT_SECRET = new TextEncoder().encode(
  process.env.BACKEND_JWT_SECRET || "dev-backend-jwt-secret-change-me"
);
const API_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_THRESHOLD_SECONDS = 5 * 60;

async function mintApiToken(userId: string, email: string): Promise<{ token: string; exp: number }> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const exp = nowSeconds + API_TOKEN_TTL_SECONDS;
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(exp)
    .sign(BACKEND_JWT_SECRET);
  return { token, exp };
}

async function refreshApiTokenIfNeeded(token: JWT): Promise<JWT> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const needsRefresh = !token.apiTokenExp || token.apiTokenExp - nowSeconds < REFRESH_THRESHOLD_SECONDS;
  if (needsRefresh && token.userId && token.email) {
    const { token: apiToken, exp } = await mintApiToken(token.userId, token.email);
    token.apiToken = apiToken;
    token.apiTokenExp = exp;
  }
  return token;
}

export const authOptions: NextAuthOptions = {
  providers: [
    // Dev-only credentials login: lets local dev and E2E tests sign in without real
    // Google/Facebook OAuth. Mirrors the backend's /auth/dev-login shortcut. Never
    // registered outside ENVIRONMENT=development.
    ...(IS_DEV_ENVIRONMENT
      ? [
          CredentialsProvider({
            id: "dev",
            name: "Dev Login",
            credentials: {
              email: { label: "Email", type: "email" },
              name: { label: "Name", type: "text" },
            },
            async authorize(credentials) {
              if (!credentials?.email) return null;
              return { id: credentials.email, email: credentials.email, name: credentials.name || "Dev User" };
            },
          }),
        ]
      : []),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID || "",
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || "",
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (account?.provider === "dev" && user?.email) {
        const res = await fetch(`${INTERNAL_API_BASE_URL}/api/v1/auth/dev-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, name: user.name || "Dev User" }),
        });
        if (!res.ok) {
          throw new Error(`dev-login failed: ${res.status}`);
        }
        const data = (await res.json()) as { user_id: string };
        token.userId = data.user_id;
        token.email = user.email;
        return await refreshApiTokenIfNeeded(token);
      }

      if (account && (profile || user)) {
        const provider = account.provider;
        if (provider !== "google" && provider !== "facebook") {
          return token;
        }

        const email = (profile?.email ?? user?.email) as string | undefined;
        const name = (profile?.name ?? user?.name ?? "Unknown") as string;
        const avatarUrl = ((profile as { picture?: string })?.picture ?? user?.image ?? null) as
          | string
          | null;
        const providerSub = account.providerAccountId;

        if (!email) {
          throw new Error("OAuth profile did not include an email address");
        }

        const res = await fetch(`${INTERNAL_API_BASE_URL}/api/v1/auth/upsert`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Secret": process.env.INTERNAL_SERVICE_SECRET || "",
          },
          body: JSON.stringify({
            email,
            name,
            avatar_url: avatarUrl,
            provider,
            provider_sub: providerSub,
          }),
        });

        if (!res.ok) {
          throw new Error(`failed to upsert user in backend: ${res.status}`);
        }

        const data = (await res.json()) as { user_id: string };
        token.userId = data.user_id;
        token.email = email;
      }

      return await refreshApiTokenIfNeeded(token);
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId;
      }
      session.apiToken = token.apiToken;
      return session;
    },
  },
};
