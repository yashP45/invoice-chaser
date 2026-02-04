import "./globals.css";
import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { TopNav } from "@/components/top-nav";
import { ToastProvider } from "@/components/toast-provider";

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display"
});

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "Invoice Chaser",
  description: "Track overdue invoices and send polite reminders.",
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <div className="app-background" aria-hidden="true" />
        <ToastProvider>
          <div className="min-h-screen">
            <TopNav />
            <main className="mx-auto max-w-6xl px-6 py-28 page-fade">
              {children}
            </main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
