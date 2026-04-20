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
  pending_approval: { variant: "outline", label: "На согласовании" },
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
  const [userRole, setUserRole] = useState<string>("");
  const [permitSearch, setPermitSearch] = useState("");
  const limit = 20;

  const fetchPermits = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
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
  }, [page, statusFilter]);

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

  const filteredPermits = permits.filter((p) => {
    if (!permitSearch) return true;
    const q = permitSearch.toLowerCase();
    return (
      p.permitNumber.toLowerCase().includes(q) ||
      p.contractor?.name.toLowerCase().includes(q)
    );
  });

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
        {(!userRole || userRole === "admin" || userRole === "contractor_admin") && (
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
            placeholder="Поиск по номеру наряда или подрядчику..."
            value={permitSearch}
            onChange={(e) => { setPermitSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusChange} itemToStringLabel={(v) => ({ all: "Все статусы", active: "Открытые", closed: "Закрытые", early_closed: "Закрыты досрочно", pending_approval: "На согласовании" }[v] ?? v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue>{(v: string) => ({ all: "Все статусы", active: "Открытые", closed: "Закрытые", early_closed: "Закрыты досрочно", pending_approval: "На согласовании" }[v] ?? v ?? "Все статусы")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="active">Открытые</SelectItem>
            <SelectItem value="closed">Закрытые</SelectItem>
            <SelectItem value="early_closed">Закрыты досрочно</SelectItem>
            <SelectItem value="pending_approval">На согласовании</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border border-zinc-200 bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Номер наряда</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Подрядчик</TableHead>
              <TableHead>Дата открытия</TableHead>
              <TableHead>Срок действия</TableHead>
              <TableHead>Участок</TableHead>
              <TableHead>Ответственный</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-zinc-500">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : filteredPermits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm text-zinc-500">Наряды-допуски не найдены</p>
                    {(!userRole || userRole === "admin" || userRole === "contractor_admin") && (
                      <Link href="/permits/new">
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <Plus className="h-4 w-4" />
                          Создать наряд-допуск
                        </Button>
                      </Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredPermits.map((permit) => (
                <TableRow key={permit.id}>
                  <TableCell className="font-mono text-xs text-zinc-700">{permit.permitNumber}</TableCell>
                  <TableCell className="text-sm text-zinc-900">{categoryLabels[permit.category] ?? permit.category}</TableCell>
                  <TableCell className="text-sm text-zinc-900 max-w-[200px] truncate">{permit.contractor?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-zinc-600">{formatDate(permit.openDate)}</TableCell>
                  <TableCell className="text-sm text-zinc-600">{formatDate(permit.expiryDate)}</TableCell>
                  <TableCell className="text-sm text-zinc-600 max-w-[200px] truncate">{permit.workSite}</TableCell>
                  <TableCell className="text-sm text-zinc-600 max-w-[150px] truncate">{permit.responsiblePerson}</TableCell>
                  <TableCell>
                    <Badge variant={statusConfig[permit.status]?.variant ?? "secondary"}>
                      {statusConfig[permit.status]?.label ?? permit.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/permits/${permit.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="size-4 mr-1" />
                        Подробнее
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filteredPermits.map((permit) => (
          <div key={permit.id} className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-zinc-700">{permit.permitNumber}</span>
              <Badge variant={statusConfig[permit.status]?.variant ?? "secondary"}>
                {statusConfig[permit.status]?.label ?? permit.status}
              </Badge>
            </div>
            <div className="text-xs text-zinc-500">
              {permit.contractor?.name ?? "—"} &bull; {formatDate(permit.openDate)} — {formatDate(permit.expiryDate)}
            </div>
            <div className="text-sm text-zinc-700">{permit.workSite}</div>
            <Link href={`/permits/${permit.id}`} className="block">
              <Button variant="outline" size="sm" className="w-full">Подробнее</Button>
            </Link>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            Показано {filteredPermits.length} из {total} нарядов-допусков
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
