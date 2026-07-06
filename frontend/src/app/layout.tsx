import type { ReactNode } from "react";

export const metadata = {
  title: "Dog Agility Judge Portal",
  description: "Manage judging contracts and class allocations",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
