"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, MapPin, Mail, Hash, Loader2 } from "lucide-react";
import { sanitize } from "@/lib/utils";
import type { Contractor, Employee } from "@/app/types";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const departmentLabels: Record<string, string> = {
  security: "Служба безопасности",
  hr: "Отдел кадров",
  safety: "Охрана труда (допуск)",
  safety_training: "Охрана труда (инструктаж)",
  permit_bureau: "Бюро пропусков",
};
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusConfig: Record<
  string,
  { variant: "outline" | "destructive" | "secondary"; label: string }
> = {
  active: { variant: "outline", label: "Активен" },
  pending: { variant: "secondary", label: "Ожидает" },
  blocked: { variant: "destructive", label: "Заблокирован" },
};

const approvalStatusMap: Record<string, { label: string; color: string }> = {
  approved: { label: "Одобрено", color: "text-emerald-600" },
  pending: { label: "В процессе", color: "text-amber-600" },
  rejected: { label: "Отклонено", color: "text-red-600" },
  blocked: { label: "Заблокирован", color: "text-zinc-400" },
};

export default function ContractorDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Resubmit dialog
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const [resubmitEmployee, setResubmitEmployee] = useState<{ id: string; fullName: string } | null>(null);
  const [resubmitComment, setResubmitComment] = useState("");
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const [orgRes, empRes, userRes] = await Promise.all([
          fetch(`/api/organizations/${id}`, { credentials: "include" }),
          fetch(`/api/employees?organizationId=${id}`, { credentials: "include" }),
          fetch("/api/auth/me", { credentials: "include" }),
        ]);

        if (!cancelled && userRes.ok) {
          const userData = await userRes.json();
          setUserRole(userData.user?.role || "");
        }

        if (cancelled) return;

        if (orgRes.ok) {
          setContractor(await orgRes.json());
        }

        if (empRes.ok) {
          const json = await empRes.json();
          setEmployees(json.data || []);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [id]);

  async function handleStatusChange(newStatus: string) {
    if (!contractor) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/organizations/${contractor.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setContractor((prev) => prev ? { ...prev, status: updated.status } : prev);
      }
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleResubmit() {
    if (!resubmitEmployee || !resubmitComment.trim()) {
      setResubmitError("Комментарий обязателен");
      return;
    }
    setResubmitting(true);
    setResubmitError("");
    try {
      const res = await fetch(`/api/approvals/${resubmitEmployee.id}/resubmit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ comment: resubmitComment.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setResubmitError(data.error || "Ошибка при отправке");
        return;
      }
      setResubmitOpen(false);
      setResubmitEmployee(null);
      setResubmitComment("");
      // Reload employees to reflect updated approvals
      const empRes = await fetch(`/api/employees?organizationId=${contractor?.id}`, { credentials: "include" });
      if (empRes.ok) {
        const json = await empRes.json();
        setEmployees(json.data || []);
      }
    } catch {
      setResubmitError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setResubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!contractor) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-zinc-500">Подрядчик не найден</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/contractors">
          <Button variant="ghost" size="icon-xs">
            <ArrowLeft />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {sanitize(contractor.name)}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Карточка подрядной организации
          </p>
        </div>
      </div>

      {/* Company info card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-5 text-zinc-400" />
            Информация о компании
          </CardTitle>
          <CardDescription>
            Основные реквизиты и контактные данные
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Статус
              </div>
              {userRole === "admin" ? (
                <Select value={contractor.status ?? "pending"} onValueChange={(v) => v && handleStatusChange(v)} disabled={updatingStatus}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <div className="flex items-center gap-1.5">
                      <span className={`size-2 rounded-full ${
                        (contractor.status ?? "pending") === "active" ? "bg-emerald-500"
                        : (contractor.status ?? "pending") === "pending" ? "bg-amber-500"
                        : "bg-red-500"
                      }`} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Активен</SelectItem>
                    <SelectItem value="pending">Ожидает</SelectItem>
                    <SelectItem value="blocked">Заблокирован</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span
                    className={`size-2 rounded-full ${contractor.status === "active" ? "bg-emerald-500" : contractor.status === "pending" ? "bg-amber-500" : "bg-red-500"}`}
                  />
                  <Badge variant={statusConfig[contractor.status].variant}>
                    {statusConfig[contractor.status].label}
                  </Badge>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                ИНН
              </div>
              <div className="flex items-center gap-2 text-sm font-mono text-zinc-900">
                <Hash className="size-3.5 text-zinc-400" />
                {contractor.inn}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                КПП
              </div>
              <div className="text-sm text-zinc-900">
                {contractor.kpp || "—"}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Адрес
              </div>
              <div className="flex items-start gap-2 text-sm text-zinc-700">
                <MapPin className="size-3.5 text-zinc-400 mt-0.5 shrink-0" />
                {sanitize(contractor.legalAddress)}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Контакты
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-700">
                <Mail className="size-3.5 text-zinc-400" />
                <span>{sanitize(contractor.contactPersonName ?? "")} ({contractor.contactEmail ?? "—"})</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Сотрудников
              </div>
              <div className="text-sm text-zinc-900">
                {contractor._count?.employees ?? 0}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employees section — placeholder until employees API is ready */}
      <Card>
        <CardHeader>
          <CardTitle>Сотрудники</CardTitle>
          <CardDescription>
            Список работников подрядной организации
          </CardDescription>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-zinc-500">
                Сотрудники ещё не добавлены
              </p>
              {(userRole === "admin" || userRole === "contractor_admin") && (
              <Link href={`/employees/new?contractorId=${contractor.id}`}>
                <Button variant="outline" size="sm" className="mt-3">
                  Добавить сотрудника
                </Button>
              </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
            {/* Desktop table */}
            <div className="hidden md:block rounded-lg border border-zinc-200 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-medium">ФИО</TableHead>
                  <TableHead className="font-medium">Должность</TableHead>
                  <TableHead className="font-medium">Классы допуска</TableHead>
                  <TableHead className="font-medium">Согласования</TableHead>
                  <TableHead className="font-medium">Документы</TableHead>
                  <TableHead className="font-medium">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => {
                  const pendingApprovals = emp.approvals.filter(
                    (a) => a.status === "pending"
                  ).length;
                  const hasRejected = emp.approvals.some(
                    (a) => a.status === "rejected"
                  );
                  const expiredDocs = emp.documents.filter(
                    (d) => d.status === "expired"
                  ).length;

                  // If any stage is rejected — the whole route is red
                  const routeStatus = hasRejected
                    ? { label: "Отклонён", color: "text-red-600" as const }
                    : emp.approvals.some((a) => a.status === "approved")
                      ? { label: "Частично", color: "text-zinc-500" as const }
                      : { label: "В процессе", color: "text-zinc-500" as const };

                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium text-zinc-900 max-w-[200px] truncate">
                        {userRole === "employee"
                          ? sanitize(emp.fullName)
                          : (
                            <Link
                              href={`/employees/${emp.id}`}
                              className="hover:text-blue-600 transition-colors"
                            >
                              {sanitize(emp.fullName)}
                            </Link>
                          )}
                      </TableCell>
                      <TableCell className="text-zinc-600 max-w-[200px] truncate">
                        {emp.position}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {emp.workClasses.slice(0, 3).map((cls) => (
                            <Badge key={cls} variant="outline" className="text-xs whitespace-nowrap">
                              {cls}
                            </Badge>
                          ))}
                          {emp.workClasses.length > 3 && (
                            <span className="text-xs text-zinc-400">
                              +{emp.workClasses.length - 3}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2 text-xs">
                          <span className={routeStatus.color}>
                            {routeStatus.label}
                          </span>
                          {pendingApprovals > 0 && (
                            <span className="text-amber-600 font-medium">
                              {pendingApprovals} ожидает
                            </span>
                          )}
                          {hasRejected && (
                            <span className="text-red-600 font-medium">
                              Маршрут отклонён
                            </span>
                          )}
                        </div>
                        <div className="mt-1 space-y-0.5">
                          {emp.approvals.slice(0, 2).map((a) => {
                            const info = approvalStatusMap[a.status];
                            const isRejectedAny = hasRejected && a.status !== "rejected";
                            return (
                              <div
                                key={a.id}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className={isRejectedAny ? "text-zinc-400" : "text-zinc-500"}>
                                  {departmentLabels[a.department] ?? a.department}
                                </span>
                                <span className={`font-medium ${hasRejected ? "text-red-600" : info.color}`}>
                                  {hasRejected ? "Отклонён" : info.label}
                                </span>
                              </div>
                            );
                          })}
                          {emp.approvals.length > 2 && (
                            <span className="text-xs text-zinc-400">+{emp.approvals.length - 2}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col gap-0.5 text-xs">
                          {emp.documents.slice(0, 2).map((doc) => (
                            <span
                              key={doc.id}
                              className={`inline-flex items-center gap-1 ${
                                doc.status === "expired"
                                  ? "text-red-600"
                                  : doc.status === "expiring"
                                    ? "text-amber-600"
                                    : "text-zinc-500"
                              }`}
                            >
                              <span
                                className={`size-1.5 rounded-full ${
                                  doc.status === "expired"
                                    ? "bg-red-500"
                                    : doc.status === "expiring"
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                }`}
                              />
                              {doc.name}
                            </span>
                          ))}
                          {emp.documents.length > 2 && (
                            <span className="text-xs text-zinc-400">+{emp.documents.length - 2}</span>
                          )}
                        </div>
                        {expiredDocs > 0 && (
                          <span className="mt-1 text-red-600 font-medium text-xs">
                            {expiredDocs} проср.
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {(userRole === "admin" || userRole === "contractor_admin") && hasRejected ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-blue-700 border-blue-200 hover:bg-blue-50"
                              onClick={() => {
                                setResubmitEmployee({ id: emp.id, fullName: emp.fullName });
                                setResubmitComment("");
                                setResubmitError("");
                                setResubmitOpen(true);
                              }}
                            >
                              Отправить на согласование
                            </Button>
                          </div>
                        ) : (
                          <Link href={`/employees/${emp.id}`}>
                            <Button variant="ghost" size="sm">
                              Подробнее
                            </Button>
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {employees.map((emp) => {
                const pendingApprovals = emp.approvals.filter(
                  (a) => a.status === "pending"
                ).length;
                const hasRejected = emp.approvals.some(
                  (a) => a.status === "rejected"
                );
                const routeStatus = hasRejected
                  ? { label: "Отклонён", color: "text-red-600" as const }
                  : emp.approvals.some((a) => a.status === "approved")
                    ? { label: "Частично", color: "text-zinc-500" as const }
                    : { label: "В процессе", color: "text-zinc-500" as const };

                return (
                  <div key={emp.id} className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-zinc-900 truncate">
                          {sanitize(emp.fullName)}
                        </div>
                        <div className="text-xs text-zinc-500">{emp.position}</div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {emp.documents.filter((d) => d.status === "expired").length > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {emp.documents.filter((d) => d.status === "expired").length} проср.
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {emp.workClasses.slice(0, 3).map((cls) => (
                        <Badge key={cls} variant="outline" className="text-xs whitespace-nowrap">
                          {cls}
                        </Badge>
                      ))}
                      {emp.workClasses.length > 3 && (
                        <span className="text-xs text-zinc-400">+{emp.workClasses.length - 3}</span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500">
                      Согласование: <span className={routeStatus.color}>{routeStatus.label}</span>
                      {pendingApprovals > 0 && (
                        <span className="ml-1 text-amber-600 font-medium">({pendingApprovals} ожидает)</span>
                      )}
                      {hasRejected && (
                        <span className="ml-1 text-red-600 font-medium">(маршрут отклонён)</span>
                      )}
                    </div>
                    <Link href={`/employees/${emp.id}`} className="block">
                      <Button variant="outline" size="sm" className="w-full">Подробнее</Button>
                    </Link>
                  </div>
                );
              })}
            </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resubmit dialog */}
      <Dialog open={resubmitOpen} onOpenChange={setResubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отправить на согласование</DialogTitle>
            <DialogDescription>
              {resubmitEmployee && `Сотрудник: ${resubmitEmployee.fullName}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Причина отправки на доработку *</Label>
              <Textarea
                placeholder="Укажите причину повторной отправки на согласование..."
                value={resubmitComment}
                onChange={(e) => setResubmitComment(e.target.value)}
                rows={3}
              />
            </div>
            {resubmitError && (
              <p className="text-sm text-red-600">{resubmitError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResubmitOpen(false); setResubmitError(""); }} disabled={resubmitting}>
              Отмена
            </Button>
            <Button onClick={handleResubmit} disabled={resubmitting || !resubmitComment.trim()}>
              {resubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Отправить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
