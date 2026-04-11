import type { Metadata } from "next";
import { Inter } from "next/font/google";
import RootLayout from "@/components/layout/root-layout";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "ЗАО «ВШЗ»",
  description: "Система управления подрядными организациями",
};

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <RootLayout>{children}</RootLayout>
      </body>
    </html>
  );
}
