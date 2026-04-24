"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./sidebar";
import Header from "./header";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/auth/unauthorized";
  const isPrintPage = pathname?.includes("/print");
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isAuthPage || isPrintPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {!isDesktop && (
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0 w-[260px] max-w-[85vw]">
            <SheetTitle className="sr-only">Меню</SheetTitle>
            <div className="h-full overflow-y-auto">
              <Sidebar />
            </div>
          </SheetContent>
        </Sheet>
      )}

      <div className="flex flex-1 flex-col overflow-hidden md:ml-[240px]">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
