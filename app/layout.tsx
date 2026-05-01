import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/context/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { NavigationProvider } from "@/contexts/NavigationContext";
import { MFAChallengeDialog } from "@/components/auth/MFAChallengeDialog";
import { IdleTimeoutGuard } from "@/components/auth/IdleTimeoutGuard";
import { SessionExpiryHandler } from "@/components/auth/SessionExpiryHandler";

export const metadata: Metadata = {
  title: "Monitrax - Personal Finance & Debt Planning",
  description: "Track your properties, loans, income, expenses and plan your debt repayment strategy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <NavigationProvider>
              {children}
            </NavigationProvider>
            <MFAChallengeDialog />
            <IdleTimeoutGuard />
            <SessionExpiryHandler />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
