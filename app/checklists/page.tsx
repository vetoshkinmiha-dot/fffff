"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, BarChart3, Loader2, X } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const statusConfig: Record<string, { variant: "outline" | "destructive" | "secondary"; label: string }> = {
  passed: { variant: "outline", label: "Пройден" },
  failed: { variant: "destructive", label: "Не пройден" },
  in_progress: { variant: "secondary", label: "В процессе" },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface Checklist {
  id: string;
  date: string;
  contractor: { name: string; sequentialNumber: number };
  inspector: string;
  score: number;
  status: string;
  passedItems: number;
  totalItems: number;
}

export default function ChecklistsPage() {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [userRole, setUserRole] = useState<string>("");
  const [userOrgId, setUserOrgId] = useState<string>("");
  const limit = 20;

  // Stats modal
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState<{
    total: number;
    passed: number;
    failed: number;
    inProgress: number;
    avgScore: number;
    monthlyTrend: { month: string; total: number; avgScore: number; passRate: number }[];
    topFailed: { question: string; failCount: number; totalCount: number; failRate: number }[];
  } | null>(null);

  const fetchChecklists = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      });
      const res = await fetch(`/api/checklists?${params}`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setChecklists(json.data ?? []);
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
    fetchChecklists();
  }, [fetchChecklists]);

  // Auth fetch once on mount
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.role) setUserRole(data.user.role);
        if (data?.user?.organizationId) setUserOrgId(data.user.organizationId);
      })
      .catch(() => {});
  }, []);

  async function fetchStats(overrideOrgId?: string) {
    const orgId = overrideOrgId ?? userOrgId;
    setStatsLoading(true);
    setStatsOpen(true);
    try {
      const url = new URL("/api/checklists/stats", window.location.origin);
      if (orgId) url.searchParams.set("contractorId", orgId);
      const res = await fetch(url.toString(), { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // ignore
    } finally {
      setStatsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Чек-листы проверок
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Проверка подрядных организаций
          </p>
        </div>
        <div className="flex items-center gap-2">
          {userRole === "admin" && (
            <Link href="/checklists/new">
              <Button variant="default" size="lg">
                <Plus />
                Создать чек-лист
              </Button>
            </Link>
          )}
          <Button variant="outline" size="lg" onClick={() => fetchStats()}>
            <BarChart3 />
            Статистика
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? "all"); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Все статусы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="passed">Пройденные</SelectItem>
            <SelectItem value="failed">Не пройденные</SelectItem>
            <SelectItem value="in_progress">В процессе</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border border-zinc-200 bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-medium">Дата</TableHead>
              <TableHead className="font-medium">Подрядчик</TableHead>
              <TableHead className="font-medium">Инспектор</TableHead>
              <TableHead className="font-medium">Результат</TableHead>
              <TableHead className="font-medium">Статус</TableHead>
              <TableHead className="text-right font-medium">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-zinc-500">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : checklists.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-zinc-500">
                  Чек-листы не найдены
                </TableCell>
              </TableRow>
            ) : (
              checklists.map((c) => {
                const pct = c.totalItems > 0 ? Math.round((c.passedItems / c.totalItems) * 100) : 0;
                return (
                  <TableRow key={c.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="text-zinc-600 font-mono text-xs">
                      {formatDate(c.date)}
                    </TableCell>
                    <TableCell className="font-medium text-zinc-900">
                      {c.contractor?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-zinc-600">{c.inspector}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-900">{pct}%</span>
                        <span className="text-xs text-zinc-400">({c.passedItems}/{c.totalItems})</span>
                      </div>
                      <div className="mt-1 h-1.5 w-24 rounded-full bg-zinc-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: c.status === "passed" ? "#10b981" : c.status === "failed" ? "#ef4444" : "#f59e0b",
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${c.status === "passed" ? "bg-emerald-500" : c.status === "failed" ? "bg-red-500" : "bg-amber-500"}`} />
                        <Badge variant={statusConfig[c.status].variant}>
                          {statusConfig[c.status].label}
                        </Badge>
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/checklists/${c.id}`}>
                        <Button variant="ghost" size="sm">Подробнее</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {checklists.map((c) => {
          const pct = Math.round((c.passedItems / c.totalItems) * 100);
          return (
            <div key={c.id} className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3 animate-fade-in hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-900">{c.contractor?.name ?? "—"}</span>
                <Badge variant={statusConfig[c.status].variant}>
                  {statusConfig[c.status].label}
                </Badge>
              </div>
              <div className="text-xs text-zinc-500">{formatDate(c.date)} • {c.inspector}</div>
              <div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{pct}%</span>
                  <span className="text-zinc-400">({c.passedItems}/{c.totalItems})</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: c.status === "passed" ? "#10b981" : c.status === "failed" ? "#ef4444" : "#f59e0b",
                    }}
                  />
                </div>
              </div>
              <Link href={`/checklists/${c.id}`} className="block">
                <Button variant="outline" size="sm" className="w-full">Подробнее</Button>
              </Link>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-zinc-400">
            Показано {checklists.length} из {total} чек-листов
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

      {/* Stats dialog */}
      <Dialog open={statsOpen} onOpenChange={(open) => { if (!open) { setStatsOpen(false); setStats(null); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Статистика чек-листов</DialogTitle>
            <DialogDescription>
              Общая статистика проверок подрядчика
            </DialogDescription>
          </DialogHeader>
          {statsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : stats && stats.total > 0 ? (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center">
                  <div className="text-3xl font-bold text-zinc-900">{stats.total}</div>
                  <div className="text-xs text-zinc-500 mt-1">Всего проверок</div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
                  <div className="text-3xl font-bold text-emerald-600">{stats.passed}</div>
                  <div className="text-xs text-emerald-600 mt-1">Пройдено</div>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                  <div className="text-3xl font-bold text-red-600">{stats.failed}</div>
                  <div className="text-xs text-red-600 mt-1">Не пройдено</div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
                  <div className="text-3xl font-bold text-blue-600">{stats.avgScore}%</div>
                  <div className="text-xs text-blue-600 mt-1">Ср. балл</div>
                </div>
              </div>

              {/* Monthly trend — only months with data */}
              {stats.monthlyTrend.filter((m) => m.total > 0).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-900 mb-3">Месячная динамика</h3>
                  <div className="space-y-2">
                    {stats.monthlyTrend.filter((m) => m.total > 0).map((m) => (
                      <div key={m.month} className="flex items-center gap-3 text-sm">
                        <span className="w-20 text-xs text-zinc-500 font-mono">{m.month}</span>
                        <span className="w-12 text-xs text-zinc-600 font-medium">{m.total}</span>
                        <div className="flex-1 h-3 rounded-full bg-zinc-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${m.passRate}%`,
                              backgroundColor: m.passRate >= 70 ? "#10b981" : m.passRate >= 40 ? "#f59e0b" : "#ef4444",
                            }}
                          />
                        </div>
                        <span className="w-10 text-xs font-medium text-right">{m.avgScore}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top failed items */}
              {stats.topFailed.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-900 mb-3">Топ-5 частых нарушений</h3>
                  <div className="space-y-1.5">
                    {stats.topFailed.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-zinc-100 last:border-0">
                        <span className="text-zinc-700 flex-1">{item.question}</span>
                        <span className="text-zinc-400 text-xs ml-2">{item.failCount}/{item.totalCount}</span>
                        <Badge variant="destructive" className="ml-2">{item.failRate}%</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No top failed */}
              {stats.topFailed.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-sm text-zinc-500">Нет нарушений по результатам проверок</p>
                </div>
              )}
            </div>
          ) : stats ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-sm text-zinc-500">Пока нет данных о проверках</p>
              <p className="text-xs text-zinc-400 mt-1">Создайте первый чек-лист проверки</p>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 text-center py-8">Не удалось загрузить статистику</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
