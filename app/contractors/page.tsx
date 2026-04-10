"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Plus, Search, Eye, Pencil } from "lucide-react";
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
import { sanitize } from "@/lib/utils";

interface Contractor {
  id: string;
  sequentialNumber: number;
  name: string;
  inn: string;
  kpp: string | null;
  status: string;
  _count: { employees: number };
}

const statusConfig: Record<
  string,
  { variant: "outline" | "destructive" | "secondary"; label: string }
> = {
  active: { variant: "outline", label: "Активен" },
  pending: { variant: "secondary", label: "Ожидает" },
  blocked: { variant: "destructive", label: "Заблокирован" },
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-500",
  pending: "bg-amber-500",
  blocked: "bg-red-500",
};

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  const fetchContractors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search ? { search } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      });
      const res = await fetch(`/api/organizations?${params}`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setContractors(json.data ?? []);
        setTotal(json.pagination?.total ?? 0);
        setTotalPages(json.pagination?.pages ?? 1);
      } else if (res.status === 401) {
        window.location.href = "/login";
      } else {
        setContractors([]);
      }
    } catch {
      setContractors([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchContractors();
  }, [fetchContractors]);

  const handleStatusChange = useCallback(
    (value: string | null) => {
      setStatusFilter(value ?? "all");
      setPage(1);
    },
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Подрядчики
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Управление подрядными организациями
          </p>
        </div>
        <Link href="/contractors/new">
          <Button variant="default" size="lg">
            <Plus />
            Добавить подрядчика
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Поиск по названию или ИНН..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Все статусы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="active">Активные</SelectItem>
            <SelectItem value="pending">Ожидающие</SelectItem>
            <SelectItem value="blocked">Заблокированные</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">№</TableHead>
              <TableHead>Название</TableHead>
              <TableHead>ИНН</TableHead>
              <TableHead>КПП</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Сотрудников</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-sm text-zinc-500"
                >
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : contractors.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-sm text-zinc-500"
                >
                  Подрядчики не найдены
                </TableCell>
              </TableRow>
            ) : (
              contractors.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-sm text-zinc-500">
                    {c.sequentialNumber}
                  </TableCell>
                  <TableCell className="font-medium text-zinc-900">
                    <Link
                      href={`/contractors/${c.id}`}
                      className="hover:text-zinc-700 transition-colors"
                    >
                      {sanitize(c.name)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-zinc-600 font-mono text-xs">
                    {c.inn}
                  </TableCell>
                  <TableCell className="text-zinc-500 font-mono text-xs">
                    {c.kpp || "—"}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`size-2 rounded-full ${statusColors[c.status]}`}
                      />
                      <Badge variant={statusConfig[c.status].variant}>
                        {statusConfig[c.status].label}
                      </Badge>
                    </span>
                  </TableCell>
                  <TableCell className="text-zinc-600">
                    {c._count?.employees ?? 0}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/contractors/${c.id}`}>
                        <Button variant="ghost" size="icon-xs">
                          <Eye />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon-xs">
                        <Pencil />
                      </Button>
                    </div>
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
            Показано {contractors.length} из {total} подрядчиков
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Вперёд
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
