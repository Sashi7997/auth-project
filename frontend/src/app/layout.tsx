import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Profile Training Tracker",
  description: "Role-based training tracker for HR, leads, and developers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
