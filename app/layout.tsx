import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Power Run",
  description: "A fast little powers-of-two arcade game."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
