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
  }, [fetchPermits]);

  const handleStatusChange = useCallback((value: string | null) => {
    setStatusFilter(value ?? "all");
    setPage(1);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Наряды-допуски
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Регистрация и учёт наряд-допусков
          </p>
        </div>
        <Link href="/permits/new">
          <Button variant="default" size="lg">
            <Plus />
            Создать наряд-допуск
          </Button>
        </Link>
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-medium">Номер наряда</TableHead>
              <TableHead className="font-medium">Категория</TableHead>
              <TableHead className="font-medium">Подрядчик</TableHead>
              <TableHead className="font-medium">Дата открытия</TableHead>
              <TableHead className="font-medium">Срок действия</TableHead>
              <TableHead className="font-medium">Участок</TableHead>
              <TableHead className="font-medium">Ответственный</TableHead>
              <TableHead className="font-medium">Статус</TableHead>
              <TableHead className="text-right font-medium">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-zinc-500">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : permits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-zinc-500">
                  Наряды-допуски не найдены
                </TableCell>
              </TableRow>
            ) : (
              permits.map((permit) => (
                <TableRow key={permit.id}>
                  <TableCell className="font-mono text-xs text-zinc-700">
                    {permit.permitNumber}
                  </TableCell>
                  <TableCell>{categoryLabels[permit.category] ?? permit.category}</TableCell>
                  <TableCell className="text-zinc-900">
                    {permit.contractor?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-zinc-600">
                    {formatDate(permit.openDate)}
                  </TableCell>
                  <TableCell className="text-zinc-600">
                    {formatDate(permit.expiryDate)}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <span className="text-sm text-zinc-600 line-clamp-2" title={permit.workSite}>
                      {permit.workSite}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate">
                    <span className="text-sm text-zinc-600" title={permit.responsiblePerson}>
                      {permit.responsiblePerson}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={statusConfig[permit.status]?.variant ?? "secondary"}>
                      {statusConfig[permit.status]?.label ?? permit.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Link href={`/permits/${permit.id}`}>
                      <Button variant="ghost" size="icon-xs">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
