import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Baggins - AI Travel Planner",
  description: "Plan your trips with AI-powered suggestions and itineraries",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
