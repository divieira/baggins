import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Baggins - AI Travel Planner",
  description: "Plan your perfect trip with AI-powered suggestions for attractions, restaurants, and activities",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
