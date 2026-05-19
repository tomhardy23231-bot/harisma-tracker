import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import QueryProvider from "./query-provider";
import { Navigation } from "@/components/Navigation";
import { WhatsNewModal } from "@/components/WhatsNewModal";
import { WaitingNotifications } from "@/components/WaitingNotifications";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono-",
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
          <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-300 to-slate-400/80">
            <header className="bg-white/90 backdrop-blur-sm border-b border-slate-200 shadow-sm sticky top-0 z-20">
              <div className="w-full max-w-[1800px] mx-auto px-4 lg:px-6 py-2 flex items-center gap-x-2">
                <h1 className="text-lg font-bold text-slate-800 tracking-tight">
                  HARISMA
                </h1>
                <p className="text-xs text-slate-500">Система отслеживания тканей</p>
                <div className="ml-auto">
                  <WaitingNotifications />
                </div>
              </div>
            </header>
            <Navigation />
            <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 lg:px-6 py-4 pb-24 md:pb-4 flex flex-col">
              {children}
            </main>
          </div>
          <WhatsNewModal />
        </QueryProvider>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
