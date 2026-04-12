"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, Eye } from "lucide-react";
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

const statusConfig: Record<string, { variant: "outline" | "default" | "secondary"; label: string }> = {
  draft: { variant: "secondary", label: "Черновик" },
  pending_approval: { variant: "outline", label: "На согласовании" },
  approved: { variant: "default", label: "Согласован" },
  active: { variant: "outline", label: "Открыт" },
  closed: { variant: "secondary", label: "Закрыт" },
  early_closed: { variant: "default", label: "Закрыт досрочно" },
  expired: { variant: "secondary", label: "Истёк" },
};

const categoryLabels: Record<string, string> = {
  hot_work: "Огневые работы",
  height_work: "Работы на высоте",
  confined_space: "Замкнутые пространства",
  electrical: "Электробезопасность",
  excavation: "Земляные работы",
  other: "Прочее",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface Permit {
  id: string;
  permitNumber: string;
  category: string;
  workSite: string;
  responsiblePerson: string;
  openDate: string;
  expiryDate: string;
  status: string;
  contractor: { name: string; sequentialNumber: number };
}

export default function PermitsPage() {
  const [permits, setPermits] = useState<Permit[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [userRole, setUserRole] = useState<string>("");
  const limit = 20;

  const fetchPermits = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search ? { search } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      });
      const res = await fetch(`/api/permits?${params}`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setPermits(json.data ?? []);
        setTotal(json.pagination?.total ?? 0);
        setTotalPages(json.pagination?.pages ?? 1);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchPermits();
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.role) setUserRole(data.user.role);
      })
      .catch(() => {});
  }, [fetchPermits]);

  const handleStatusChange = useCallback((value: string | null) => {
    setStatusFilter(value ?? "all");
    setPage(1);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Наряды-допуски
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Регистрация и учёт наряд-допусков
          </p>
        </div>
        {(userRole === "admin" || userRole === "contractor_employee") && (
        <Link href="/permits/new">
          <Button variant="default" size="lg">
            <Plus />
            Создать наряд-допуск
          </Button>
        </Link>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Поиск по номеру или подрядчику..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Все статусы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="active">Открытые</SelectItem>
            <SelectItem value="closed">Закрытые</SelectItem>
            <SelectItem value="early_closed">Закрыты досрочно</SelectItem>
            <SelectItem value="draft">Черновики</SelectItem>
            <SelectItem value="pending_approval">На согласовании</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full caption-bottom text-sm">
          <thead>
            <tr className="border-b">
              <th className="h-10 px-2 text-left align-middle font-medium">Номер наряда</th>
              <th className="h-10 px-2 text-left align-middle font-medium">Категория</th>
              <th className="h-10 px-2 text-left align-middle font-medium">Подрядчик</th>
              <th className="h-10 px-2 text-left align-middle font-medium">Дата открытия</th>
              <th className="h-10 px-2 text-left align-middle font-medium">Срок действия</th>
              <th className="h-10 px-2 text-left align-middle font-medium">Участок</th>
              <th className="h-10 px-2 text-left align-middle font-medium">Ответственный</th>
              <th className="h-10 px-2 text-left align-middle font-medium">Статус</th>
              <th className="h-10 px-2 text-right align-middle font-medium">Действия</th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {loading ? (
              <tr className="border-b">
                <td colSpan={9} className="p-2 py-8 text-center text-sm text-zinc-500">
                  Загрузка...
                </td>
              </tr>
            ) : permits.length === 0 ? (
              <tr className="border-b">
                <td colSpan={9} className="p-2 py-8 text-center text-sm text-zinc-500">
                  Наряды-допуски не найдены
                </td>
              </tr>
            ) : (
              permits.map((permit) => (
                <tr key={permit.id} className="border-b transition-colors hover:bg-muted/50">
                  <td className="p-2 font-mono text-xs text-zinc-700">{permit.permitNumber}</td>
                  <td className="p-2 text-sm text-zinc-900">{categoryLabels[permit.category] ?? permit.category}</td>
                  <td className="p-2 text-sm text-zinc-900 max-w-[200px] truncate">{permit.contractor?.name ?? "—"}</td>
                  <td className="p-2 text-sm text-zinc-600">{formatDate(permit.openDate)}</td>
                  <td className="p-2 text-sm text-zinc-600">{formatDate(permit.expiryDate)}</td>
                  <td className="p-2 text-sm text-zinc-600 max-w-[200px] truncate">{permit.workSite}</td>
                  <td className="p-2 text-sm text-zinc-600 max-w-[150px] truncate">{permit.responsiblePerson}</td>
                  <td className="p-2">
                    <Badge variant={statusConfig[permit.status]?.variant ?? "secondary"}>
                      {statusConfig[permit.status]?.label ?? permit.status}
                    </Badge>
                  </td>
                  <td className="p-2 text-right">
                    <Link href={`/permits/${permit.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="size-4 mr-1" />
                        Подробнее
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            Показано {permits.length} из {total} нарядов-допусков
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
