"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, Eye, FileInput } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const severityConfig: Record<string, { className: string; label: string }> = {
  low: { className: "bg-green-50 text-green-700 border-green-200", label: "Низкий" },
  medium: { className: "bg-amber-50 text-amber-700 border-amber-200", label: "Средний" },
  high: { className: "bg-orange-50 text-orange-700 border-orange-200", label: "Высокий" },
  critical: { className: "bg-red-50 text-red-700 border-red-200", label: "Критический" },
};

const statusLabels: Record<string, string> = {
  pending: "Ожидает",
  resolved: "Устранено",
  escalated: "Эскалировано",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface Violation {
  id: string;
  violationNumber: string;
  date: string;
  description: string;
  severity: string;
  status: string;
  contractor: { name: string; sequentialNumber: number };
  createdBy: { fullName: string } | null;
}

export default function ViolationsPage() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userRole, setUserRole] = useState<string>("");
  const limit = 20;

  const fetchViolations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(severityFilter !== "all" ? { severity: severityFilter } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      });
      const res = await fetch(`/api/violations?${params}`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setViolations(json.data ?? []);
        setTotal(json.pagination?.total ?? 0);
        setTotalPages(json.pagination?.pages ?? 1);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, severityFilter, statusFilter]);

  useEffect(() => {
    fetchViolations();
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.role) setUserRole(data.user.role);
      })
      .catch(() => {});
  }, [fetchViolations]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Акты нарушений
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Фиксация нарушений подрядных организаций
          </p>
        </div>
        <div className="flex items-center gap-2">
          {userRole === "admin" && (
          <Link href="/violations/templates">
            <Button variant="outline" size="lg">
              <FileInput />
              Шаблоны
            </Button>
          </Link>
          )}
          <Link href="/violations/new">
            <Button variant="default" size="lg">
              <Plus />
              Создать акт
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v ?? "all"); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Все тяжести" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все тяжести</SelectItem>
            <SelectItem value="low">Низкий</SelectItem>
            <SelectItem value="medium">Средний</SelectItem>
            <SelectItem value="high">Высокий</SelectItem>
            <SelectItem value="critical">Критический</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? "all"); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Все статусы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="pending">Ожидает</SelectItem>
            <SelectItem value="resolved">Устранено</SelectItem>
            <SelectItem value="escalated">Эскалировано</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-medium">Номер акта</TableHead>
              <TableHead className="font-medium">Дата</TableHead>
              <TableHead className="font-medium">Подрядчик</TableHead>
              <TableHead className="font-medium">Описание</TableHead>
              <TableHead className="font-medium">Тяжесть</TableHead>
              <TableHead className="font-medium">Статус</TableHead>
              <TableHead className="text-right font-medium">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-zinc-500">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : violations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-zinc-500">
                  Нарушения не найдены
                </TableCell>
              </TableRow>
            ) : (
              violations.map((v) => {
                const sev = severityConfig[v.severity] ?? severityConfig.low;
                return (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs text-zinc-700">
                      {v.violationNumber}
                    </TableCell>
                    <TableCell className="text-zinc-600 font-mono text-xs">
                      {formatDate(v.date)}
                    </TableCell>
                    <TableCell className="text-zinc-900">
                      {v.contractor?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600 max-w-md truncate">
                      {v.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={sev.className}>
                        {sev.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600">
                      {statusLabels[v.status] ?? v.status}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/violations/${v.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          Подробнее
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            Показано {violations.length} из {total} нарушений
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Назад
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Вперёд
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
