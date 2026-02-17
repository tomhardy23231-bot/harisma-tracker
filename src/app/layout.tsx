import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import QueryProvider from "./query-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HARISMA",
  description: "Внутренняя система управления заказами тканей для HARISMA",
  keywords: ["HARISMA", "Next.js", "TypeScript", "Tailwind CSS", "shadcn/ui", "управление заказами", "ткани", "CRM"],
  authors: [{ name: "HARISMA Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "HARISMA",
    description: "Внутренняя система управления заказами тканей для HARISMA",
    url: "https://harisma.app", // Assuming a hypothetical URL for openGraph
    siteName: "HARISMA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HARISMA",
    description: "Внутренняя система управления заказами тканей для HARISMA",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <QueryProvider>
          {children}
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
