"use client";

import { useEffect, useState, useCallback } from "react";
import { Building2, Users, Clock, AlertTriangle, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardData {
  totalContractors: number;
  activePermits: number;
  pendingApprovals: number;
  monthlyViolations: number;
}

function fetchDashboard(): Promise<DashboardData | null> {
  return fetch("/api/dashboard", { credentials: "include" })
    .then((r) => r.ok ? r.json() : null)
    .catch(() => null);
}

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState<string>("");

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const d = await fetchDashboard();
    if (d) setData(d);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    refresh();

    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.role) setUserRole(data.user.role);
      })
      .catch(() => {});

    // Re-fetch when tab becomes visible (user navigated back)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [refresh]);

  const isApprover = userRole === "department_approver";

  const kpis = isApprover
    ? [
        {
          label: "Всего подрядчиков",
          value: data?.totalContractors ?? "—",
          icon: Building2,
          color: "text-blue-600",
          bg: "bg-blue-50",
        },
        {
          label: "Всего сотрудников",
          value: data?.activePermits ?? "—",
          icon: Users,
          color: "text-green-600",
          bg: "bg-green-50",
        },
        {
          label: "Ожидают от меня",
          value: data?.pendingApprovals ?? "—",
          icon: Clock,
          color: "text-amber-600",
          bg: "bg-amber-50",
        },
      ]
    : [
        {
          label: "Всего подрядчиков",
          value: data?.totalContractors ?? "—",
          icon: Building2,
          color: "text-blue-600",
          bg: "bg-blue-50",
        },
        {
          label: "Активные наряды",
          value: data?.activePermits ?? "—",
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
          value: data?.monthlyViolations ?? "—",
          icon: AlertTriangle,
          color: "text-red-600",
          bg: "bg-red-50",
        },
      ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Панель управления
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Обзор текущей активности подрядчиков
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={refreshing}
          className="gap-1.5"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Обновить
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, color, bg }, i) => (
          <div
            key={label}
            className="rounded-lg border border-zinc-200 bg-white p-5 animate-fade-in hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-default"
            style={{ animationDelay: `${(i + 1) * 60}ms` }}
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
