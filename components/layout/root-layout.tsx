"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./sidebar";
import Header from "./header";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/auth/unauthorized";
  const isPrintPage = pathname?.includes("/print");

  if (isAuthPage || isPrintPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      <div className="ml-[240px] flex flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
