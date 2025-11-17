import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
