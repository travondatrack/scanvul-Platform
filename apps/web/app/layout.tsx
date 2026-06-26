export const dynamic = "force-dynamic";
import type { Metadata } from "next";

import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "ScanVul AI | Advanced Security Engine",
  description: "Next-gen SAST and Secret Scanning with AI-powered false positive elimination.",
};

import { Providers } from "./providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
