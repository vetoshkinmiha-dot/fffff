"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon: typeof Building2;
}

const allNavItems: NavItem[] = [
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

// Role model per ролевая модель.docx
const ROLE_VISIBLE_NAV: Record<string, string[]> = {
  // Администратор — всё кроме "Моя организация"
  admin: allNavItems.filter((n) => n.label !== "Моя организация").map((n) => n.href),

  // Сотрудник завода обычный — нет дашборда, нет нарядов
  employee: ["/contractors", "/employees", "/violations", "/violations/*", "/documents", "/documents/*", "/checklists", "/checklists/*"],

  // Сотрудник завода с правом согласования — дашборд + подрядчики/сотрудники/наряды(просмотр)/нарушения/документы/чек-листы (только свои как инспектор) + согласования
  department_approver: ["/", "/contractors", "/contractors/*", "/employees", "/employees/*", "/permits", "/permits/*", "/permits/*/print", "/violations", "/violations/*", "/violations/*/print", "/documents", "/documents/*", "/checklists", "/checklists/*", "/approvals", "/approvals/*"],

  // Ответственный подрядной организацией — нет дашборда, нет подрядчики, нет чек-листы, нет согласования
  contractor_admin: ["/my-organization", "/employees", "/employees/*", "/permits", "/permits/*", "/permits/*/print", "/permits/*/edit", "/violations", "/violations/*", "/violations/*/print", "/documents", "/documents/*"],

  // Сотрудник подрядной организации — нет дашборда, нет подрядчики, нет чек-листы, нет согласования
  contractor_employee: ["/my-organization", "/employees", "/employees/*", "/permits", "/permits/*", "/permits/*/print", "/violations", "/violations/*", "/violations/*/print", "/documents", "/documents/*"],
};

export default function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.role) setRole(data.user.role);
      })
      .catch(() => {});
  }, []);

  const allowedHrefs = role ? ROLE_VISIBLE_NAV[role] : allNavItems.map((n) => n.href);
  const navItems = allNavItems.filter((item) => allowedHrefs?.includes(item.href));

  return (
    <aside className="fixed left-0 top-0 z-30 h-full w-[240px] border-r border-zinc-200 bg-zinc-50 flex flex-col">
      <div className="flex h-14 items-center px-4 border-b border-zinc-200">
        <span className="text-base font-semibold tracking-tight text-zinc-900">
          ЗАО «ВШЗ»
        </span>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === "/"
              ? pathname === "/"
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
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
    </aside>
  );
}
