import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "CodeGuard AI",
  description: "Hybrid SAST scanner with AI-assisted vulnerability analysis",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
