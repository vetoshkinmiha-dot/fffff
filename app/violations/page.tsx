"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, Eye, FileInput, MessageSquare, Loader2, X } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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

const complaintStatusLabels: Record<string, string> = {
  pending: "Ожидает",
  resolved: "Рассмотрено",
  rejected: "Отклонено",
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

interface Complaint {
  id: string;
  complaintText: string;
  department: string;
  status: string;
  violation: { id: string; violationNumber: string } | null;
  contractor: { name: string } | null;
  createdBy: { fullName: string } | null;
  createdAt: string;
}

interface OrgViolation {
  id: string;
  violationNumber: string;
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

  // Complaint tab state
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [complaintPage, setComplaintPage] = useState(1);
  const [complaintTotal, setComplaintTotal] = useState(0);
  const [complaintTotalPages, setComplaintTotalPages] = useState(1);
  const [complaintStatusFilter, setComplaintStatusFilter] = useState("all");

  // Tab state
  const [activeTab, setActiveTab] = useState<"violations" | "complaints">("violations");

  // Complaint modal state
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [complaintText, setComplaintText] = useState("");
  const [complaintDept, setComplaintDept] = useState("curator");
  const [complaintViolationId, setComplaintViolationId] = useState("");
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [complaintError, setComplaintError] = useState("");
  const [orgViolations, setOrgViolations] = useState<OrgViolation[]>([]);

  const limit = 20;

  const isContractorRole = userRole === "contractor_admin" || userRole === "contractor_employee";
  const isAdminRole = userRole === "admin";

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

  const fetchComplaints = useCallback(async () => {
    setComplaintsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(complaintPage),
        limit: String(limit),
        ...(complaintStatusFilter !== "all" ? { status: complaintStatusFilter } : {}),
      });
      const res = await fetch(`/api/complaints?${params}`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setComplaints(json.data ?? []);
        setComplaintTotal(json.pagination?.total ?? 0);
        setComplaintTotalPages(json.pagination?.pages ?? 1);
      }
    } catch {
      // ignore
    } finally {
      setComplaintsLoading(false);
    }
  }, [complaintPage, complaintStatusFilter]);

  const fetchOrgViolations = useCallback(async () => {
    try {
      const res = await fetch(`/api/violations?contractorId=me&limit=50`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setOrgViolations(json.data ?? []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.role) setUserRole(data.user.role);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === "violations") {
      fetchViolations();
    } else if (activeTab === "complaints") {
      fetchComplaints();
    }
  }, [activeTab, fetchViolations, fetchComplaints]);

  async function handleCreateComplaint() {
    if (!complaintText.trim()) {
      setComplaintError("Напишите текст жалобы");
      return;
    }
    setSubmittingComplaint(true);
    setComplaintError("");
    try {
      const body: any = { complaintText: complaintText.trim(), department: complaintDept };
      if (complaintViolationId) body.violationId = complaintViolationId;

      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setComplaintModalOpen(false);
        setComplaintText("");
        setComplaintViolationId("");
        fetchComplaints();
      } else {
        const data = await res.json();
        setComplaintError(data.error || "Ошибка при отправке жалобы");
      }
    } catch {
      setComplaintError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setSubmittingComplaint(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with tabs for admin */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              {activeTab === "violations" ? "Акты нарушений" : "Жалобы"}
            </h1>
            {/* Tab switcher — only visible to admin */}
            {isAdminRole && (
              <div className="flex rounded-md border border-zinc-200 bg-white p-0.5">
                <button
                  onClick={() => setActiveTab("violations")}
                  className={`px-3 py-1.5 text-sm font-medium rounded ${
                    activeTab === "violations"
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  Акты нарушений
                </button>
                <button
                  onClick={() => setActiveTab("complaints")}
                  className={`px-3 py-1.5 text-sm font-medium rounded ${
                    activeTab === "complaints"
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  Жалобы
                </button>
              </div>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {activeTab === "violations"
              ? "Фиксация нарушений подрядных организаций"
              : "Жалобы подрядных организаций"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "violations" && isAdminRole && (
            <Link href="/violations/templates">
              <Button variant="outline" size="lg">
                <FileInput />
                Шаблоны
              </Button>
            </Link>
          )}
          {activeTab === "violations" && (userRole === "admin" || userRole === "employee" || userRole === "department_approver") && (
            <Link href="/violations/new">
              <Button variant="default" size="lg">
                <Plus />
                Создать акт
              </Button>
            </Link>
          )}
          {/* Contractor roles: show complaint button instead of create violation */}
          {activeTab === "violations" && isContractorRole && (
            <Button variant="default" size="lg" onClick={() => { setComplaintModalOpen(true); fetchOrgViolations(); }}>
              <MessageSquare />
              Подать жалобу
            </Button>
          )}
        </div>
      </div>

      {/* Violations tab content */}
      {activeTab === "violations" && (
        <>
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
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? "all"); setPage(1); }} itemToStringLabel={(v) => ({ all: "Все статусы", pending: "Ожидает", resolved: "Устранено", escalated: "Эскалировано" }[v] ?? v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue>{(v: string) => ({ all: "Все статусы", pending: "Ожидает", resolved: "Устранено", escalated: "Эскалировано" }[v] ?? v ?? "Все статусы")}</SelectValue>
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
                    <TableCell colSpan={7} className="py-8">
                      <div className="flex flex-col items-center gap-3">
                        <p className="text-sm text-zinc-500">Нарушения не найдены</p>
                        {(userRole === "admin" || userRole === "employee") && (
                          <Link href="/violations/new">
                            <Button variant="outline" size="sm" className="gap-1.5">
                              <Plus className="h-4 w-4" />
                              Создать акт нарушения
                            </Button>
                          </Link>
                        )}
                      </div>
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
        </>
      )}

      {/* Complaints tab content */}
      {activeTab === "complaints" && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={complaintStatusFilter} onValueChange={(v) => { setComplaintStatusFilter(v ?? "all"); setComplaintPage(1); }}>
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

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-medium">Подрядчик</TableHead>
                  <TableHead className="font-medium">Департамент</TableHead>
                  <TableHead className="font-medium">Текст</TableHead>
                  <TableHead className="font-medium">Связанный акт</TableHead>
                  <TableHead className="font-medium">Статус</TableHead>
                  <TableHead className="font-medium">Дата</TableHead>
                  <TableHead className="text-right font-medium">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {complaintsLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-zinc-500">
                      Загрузка...
                    </TableCell>
                  </TableRow>
                ) : complaints.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-zinc-500">
                      Жалобы не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  complaints.map((c) => {
                    const statusColor = c.status === "pending"
                      ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                      : c.status === "resolved"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-red-50 text-red-700 border-red-200";
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
                          <Badge variant="outline" className={statusColor}>
                            {complaintStatusLabels[c.status] ?? c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-zinc-600 font-mono text-xs">
                          {formatDate(c.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/complaints/${c.id}`}>
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

          {complaintTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-xs text-zinc-400">
                Показано {complaints.length} из {complaintTotal} жалоб
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={complaintPage <= 1} onClick={() => setComplaintPage((p) => p - 1)}>
                  Назад
                </Button>
                <Button variant="outline" size="sm" disabled={complaintPage >= complaintTotalPages} onClick={() => setComplaintPage((p) => p + 1)}>
                  Вперёд
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Complaint creation modal */}
      <Dialog open={complaintModalOpen} onOpenChange={setComplaintModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Подать жалобу</DialogTitle>
            <DialogDescription>
              Заполните форму для подачи жалобы
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Департамент</Label>
              <Select value={complaintDept} onValueChange={setComplaintDept}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(departmentLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Текст жалобы</Label>
              <Textarea
                value={complaintText}
                onChange={(e) => setComplaintText(e.target.value)}
                placeholder="Опишите причину жалобы..."
                rows={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Связанный акт нарушения (опционально)</Label>
              <Select value={complaintViolationId} onValueChange={setComplaintViolationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Без привязки к акту" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Без привязки к акту</SelectItem>
                  {orgViolations.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.violationNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {complaintError && (
              <p className="text-sm text-red-600">{complaintError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComplaintModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreateComplaint} disabled={submittingComplaint || !complaintText.trim()}>
              {submittingComplaint && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Отправить жалобу
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
