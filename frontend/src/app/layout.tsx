import type { ReactNode } from "react";

import { SessionProviderWrapper } from "@/components/SessionProviderWrapper";

import "./globals.css";

export const metadata = {
  title: "Dog Agility Judge Portal",
  description: "Manage judging contracts and class allocations",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
