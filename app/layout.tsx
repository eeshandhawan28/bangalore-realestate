import type { Metadata } from "next";
import dynamic from "next/dynamic";
import "./globals.css";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { Sidebar } from "@/components/shared/Sidebar";
import { BottomNav } from "@/components/shared/BottomNav";

const ChatBubble = dynamic(() => import("@/components/chat/ChatBubble"), { ssr: false });

export const metadata: Metadata = {
  title: "PropIQ - Bangalore Real Estate Intelligence",
  description:
    "AI-powered property valuation, portfolio tracking, and market analytics for Bangalore real estate",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 lg:ml-[240px] pb-16 lg:pb-0">
              {children}
            </main>
          </div>
          <BottomNav />
          <ChatBubble />
        </ThemeProvider>
      </body>
    </html>
  );
}
