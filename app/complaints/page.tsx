"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const complaintStatusLabels: Record<string, string> = {
  pending: "Ожидает",
  resolved: "Рассмотрено",
  rejected: "Отклонено",
};

const complaintStatusConfig: Record<string, { className: string; icon: React.ReactNode }> = {
  pending: {
    className: "bg-yellow-50 text-yellow-700 border-yellow-200",
    icon: <AlertCircle className="h-3 w-3" />,
  },
  resolved: {
    className: "bg-green-50 text-green-700 border-green-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  rejected: {
    className: "bg-red-50 text-red-700 border-red-200",
    icon: <XCircle className="h-3 w-3" />,
  },
};

const departmentLabels: Record<string, string> = {
  hse: "ОТ и ПБ (HSE)",
  curator: "Куратор договора",
  procurement: "Закупки",
  quality: "Качество",
  legal: "Юридический отдел",
  finance: "Финансовый отдел",
  hr_department: "Отдел кадров",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface Complaint {
  id: string;
  complaintText: string;
  department: string;
  status: string;
  resolutionNotes: string | null;
  violation: { id: string; violationNumber: string } | null;
  contractor: { name: string; sequentialNumber: number } | null;
  createdBy: { fullName: string; id: string } | null;
  createdAt: string;
}

export default function ComplaintsPage() {
  const router = useRouter();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [userRole, setUserRole] = useState<string>("");
  const [authorized, setAuthorized] = useState(false);

  // Detail dialog state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailComplaint, setDetailComplaint] = useState<Complaint | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolving, setResolving] = useState(false);

  const limit = 20;

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.role) {
          setUserRole(data.user.role);
          if (data.user.role === "admin") {
            setAuthorized(true);
          } else {
            router.push("/violations");
          }
        }
      })
      .catch(() => {});
  }, [router]);

  const fetchComplaints = useCallback(async () => {
    if (!authorized) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      });
      const res = await fetch(`/api/complaints?${params}`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setComplaints(json.data ?? []);
        setTotal(json.pagination?.total ?? 0);
        setTotalPages(json.pagination?.pages ?? 1);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, authorized]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  async function handleResolve(status: "resolved" | "rejected") {
    if (!detailComplaint || !resolveNotes.trim()) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/complaints/${detailComplaint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolutionNotes: resolveNotes.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        // Update in list
        setComplaints((prev) =>
          prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
        );
        setDetailComplaint((prev) => (prev ? { ...prev, ...updated } : null));
        fetchComplaints();
      }
    } catch {
      // ignore
    } finally {
      setResolving(false);
    }
  }

  function openDetail(complaint: Complaint) {
    setDetailComplaint(complaint);
    setResolveNotes("");
    setDetailOpen(true);
  }

  if (!authorized) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Жалобы подрядчиков
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Управление жалобами подрядных организаций
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? "all"); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Все статусы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="pending">Ожидает</SelectItem>
            <SelectItem value="resolved">Рассмотрено</SelectItem>
            <SelectItem value="rejected">Отклонено</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-medium">Подрядчик</TableHead>
              <TableHead className="font-medium">Департамент</TableHead>
              <TableHead className="font-medium">Текст</TableHead>
              <TableHead className="font-medium">Связанный акт</TableHead>
              <TableHead className="font-medium">Статус</TableHead>
              <TableHead className="font-medium">Кто подал</TableHead>
              <TableHead className="font-medium">Дата</TableHead>
              <TableHead className="text-right font-medium">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-zinc-500">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : complaints.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-zinc-500">
                  Жалобы не найдены
                </TableCell>
              </TableRow>
            ) : (
              complaints.map((c) => {
                const cfg = complaintStatusConfig[c.status] ?? complaintStatusConfig.pending;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-zinc-900">
                      {c.contractor?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-zinc-600">
                      {departmentLabels[c.department] ?? c.department}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600 max-w-md truncate">
                      {c.complaintText}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-700">
                      {c.violation?.violationNumber ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cfg.className}>
                        {cfg.icon}
                        <span className="ml-1">{complaintStatusLabels[c.status] ?? c.status}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-zinc-600">
                      {c.createdBy?.fullName ?? "—"}
                    </TableCell>
                    <TableCell className="text-zinc-600 font-mono text-xs">
                      {formatDate(c.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(c)}>
                        <Eye className="h-4 w-4 mr-1" />
                        Подробнее
                      </Button>
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
            Показано {complaints.length} из {total} жалоб
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

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Детали жалобы</DialogTitle>
            <DialogDescription>
              {detailComplaint?.contractor?.name ?? "—"} · {detailComplaint ? departmentLabels[detailComplaint.department] ?? detailComplaint.department : ""}
            </DialogDescription>
          </DialogHeader>
          {detailComplaint && (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>Текст жалобы</Label>
                <div className="text-sm text-zinc-900 whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  {detailComplaint.complaintText}
                </div>
              </div>
              {detailComplaint.violation && (
                <div className="space-y-1">
                  <Label>Связанный акт</Label>
                  <div className="text-sm">
                    <Link href={`/violations/${detailComplaint.violation.id}`} className="font-mono text-zinc-900 underline">
                      {detailComplaint.violation.violationNumber}
                    </Link>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-zinc-400">Кто подал:</span> {detailComplaint.createdBy?.fullName ?? "—"}
                </div>
                <div>
                  <span className="text-zinc-400">Дата:</span> {formatDate(detailComplaint.createdAt)}
                </div>
              </div>
              {detailComplaint.status !== "pending" && (
                <div className="space-y-1">
                  <Label>Резолюция</Label>
                  <Badge variant="outline" className={complaintStatusConfig[detailComplaint.status]?.className}>
                    {complaintStatusLabels[detailComplaint.status]}
                  </Badge>
                  <div className="text-sm text-zinc-900 whitespace-pre-wrap mt-1">
                    {detailComplaint.resolutionNotes}
                  </div>
                </div>
              )}
              {detailComplaint.status === "pending" && (
                <div className="space-y-3 pt-2 border-t border-zinc-200">
                  <Label>Рассмотреть жалобу</Label>
                  <Textarea
                    value={resolveNotes}
                    onChange={(e) => setResolveNotes(e.target.value)}
                    placeholder="Примечания по рассмотрению..."
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      className="gap-2 bg-green-600 hover:bg-green-700"
                      onClick={() => handleResolve("resolved")}
                      disabled={resolving || !resolveNotes.trim()}
                    >
                      {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Рассмотрено
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleResolve("rejected")}
                      disabled={resolving || !resolveNotes.trim()}
                    >
                      {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Отклонено
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
