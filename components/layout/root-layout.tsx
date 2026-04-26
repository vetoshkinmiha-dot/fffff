"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Sidebar from "./sidebar";
import Header from "./header";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Building2,
  Users,
  FileText,
  AlertTriangle,
  CheckSquare,
  BookOpen,
  ClipboardCheck,
  LayoutDashboard,
  Home,
  LogOut,
} from "lucide-react";

const navItems = [
  { label: "Дашборд", href: "/", icon: LayoutDashboard },
  { label: "Моя организация", href: "/my-organization", icon: Home },
  { label: "Подрядчики", href: "/contractors", icon: Building2 },
  { label: "Сотрудники", href: "/employees", icon: Users },
  { label: "Наряды-допуски", href: "/permits", icon: FileText },
  { label: "Акты нарушений", href: "/violations", icon: AlertTriangle },
  { label: "Чек-листы", href: "/checklists", icon: CheckSquare },
  { label: "Нормативные документы", href: "/documents", icon: BookOpen },
  { label: "Согласования", href: "/approvals", icon: ClipboardCheck },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/auth/unauthorized";
  const isPrintPage = pathname?.includes("/print");
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
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-[260px] max-w-[85vw] border-r border-zinc-200">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex h-14 items-center px-4 border-b border-zinc-200 shrink-0">
              <span className="text-base font-semibold tracking-tight text-zinc-900">
                ЗАО «ВШЗ»
              </span>
            </div>
            {/* Nav items */}
            <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
              {navItems.map(({ label, href, icon: Icon }) => {
                const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
            {/* Footer */}
            <div className="shrink-0 p-3 border-t border-zinc-200">
              <button
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                  window.location.href = "/login";
                }}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors w-full"
              >
                <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                <span>Выйти</span>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden md:ml-[240px]">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
