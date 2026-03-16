import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import QueryProvider from "./query-provider";
import { Navigation } from "@/components/Navigation";

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
          <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
            <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20">
              <div className="container mx-auto px-4 py-2 flex items-baseline gap-x-2">
                <h1 className="text-lg font-bold text-slate-800 tracking-tight">
                  HARISMA
                </h1>
                <p className="text-xs text-slate-500">Система отслеживания тканей</p>
              </div>
            </header>
            <Navigation />
            <main className="flex-1 container mx-auto px-4 py-4 flex flex-col">
              {children}
            </main>
          </div>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
