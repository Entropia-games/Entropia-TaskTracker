import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { AuthGateProvider } from "@/lib/auth-gate-context";
import { IssuesProvider } from "@/lib/issues-context";
import { ToastViewport } from "@/lib/toast";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "lin",
  description: "Project management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex">
        <TooltipProvider>
          <AuthProvider>
            <AuthGateProvider>
            <IssuesProvider>
            <SidebarProvider defaultOpen={true}>
              <AppSidebar />
              <main className="flex flex-1 flex-col">
                <div className="flex items-center gap-2 border-b border-border/50 px-4 py-2">
                  <SidebarTrigger />
                </div>
                {children}
              </main>
              <ToastViewport />
            </SidebarProvider>
            </IssuesProvider>
            </AuthGateProvider>
          </AuthProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
