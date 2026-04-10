"use client";

import { useEffect, useState } from "react";
import { Building2, FileText, Clock, AlertTriangle } from "lucide-react";

interface DashboardData {
  totalContractors: number;
  activePermits: number;
  pendingApprovals: number;
  monthlyViolations: number;
}

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d: DashboardData | null) => { if (d) setData(d); })
      .catch(() => {});
  }, []);

  const kpis = [
    {
      label: "Всего подрядчиков",
      value: data?.totalContractors ?? "—",
      icon: Building2,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Активные наряды",
      value: "Скоро",
      icon: FileText,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Ожидают согласования",
      value: data?.pendingApprovals ?? "—",
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Нарушения за месяц",
      value: "Скоро",
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Панель управления
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Обзор текущей активности подрядчиков
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="rounded-lg border border-zinc-200 bg-white p-5"
          >
            <div className="flex items-center justify-between">
              <div className={`rounded-md ${bg} p-2.5`}>
                <Icon className={`h-5 w-5 ${color}`} strokeWidth={1.8} />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-semibold text-zinc-900">
                {value}
              </div>
              <div className="mt-0.5 text-sm text-zinc-500">{label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
