import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI API Proxy",
  description: "Mobile-first AI API proxy"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
