"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { sanitize } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────

interface EmployeeApproval {
  id: string;
  employeeId: string;
  employeeName: string;
  contractorName: string;
  department: string;
  departmentName: string;
  status: "pending" | "approved" | "rejected" | "blocked";
  deadline: string;
  comment: string | null;
  position?: string;
  workClasses?: { workClass: string }[];
}

interface PermitApproval {
  id: string;
  permitNumber: string;
  contractor: { id: string; name: string };
  workSite: string;
  responsiblePerson: string;
  openDate: string;
  expiryDate: string;
  status: string;
  approvals: Array<{
    id: string;
    department: string;
    status: string;
    comment: string | null;
  }>;
}

const statusConfig: Record<
  string,
  { variant: "outline" | "default" | "secondary"; label: string }
> = {
  pending: { variant: "secondary", label: "Ожидает" },
  approved: { variant: "default", label: "Согласовано" },
  rejected: { variant: "secondary", label: "Отклонено" },
  blocked: { variant: "outline", label: "Заблокирован" },
};

const permitStatusConfig: Record<string, { variant: "outline" | "default" | "secondary"; label: string }> = {
  pending_approval: { variant: "secondary", label: "На согласовании" },
  active: { variant: "default", label: "Действует" },
  closed: { variant: "outline", label: "Закрыт" },
};

const DEPARTMENT_NAMES: Record<string, string> = {
  security: "Служба безопасности",
  hr: "Отдел кадров",
  safety: "Охрана труда",
  safety_training: "Вводный инструктаж",
  permit_bureau: "Бюро пропусков",
};

const DEPARTMENT_KEYS = ["security", "hr", "safety", "safety_training", "permit_bureau"] as const;

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─── Main Page ──────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  // Tab state: "permits" | "employees" (admin only)
  const [mainTab, setMainTab] = useState<"permits" | "employees">("permits");

  // Department tab (admin employees tab + department_approver)
  const [deptTab, setDeptTab] = useState<string>("security");

  // Data
  const [employeeApprovals, setEmployeeApprovals] = useState<EmployeeApproval[]>([]);
  const [permitApprovals, setPermitApprovals] = useState<PermitApproval[]>([]);

  // Decision dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"approve" | "reject">("approve");
  const [dialogComment, setDialogComment] = useState("");
  const [dialogApprovalId, setDialogApprovalId] = useState("");
  const [dialogType, setDialogType] = useState<"employee" | "permit">("employee");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ── Fetch user role ──
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.role) {
          setRole(data.user.role);
          if (data.user.role === "employee") {
            router.replace("/");
          }
          // department_approver defaults to their department
          if (data.user.role === "department_approver" && data.user.department) {
            setDeptTab(data.user.department);
          }
        }
      })
      .catch(() => {});
  }, [router]);

  // ── Fetch employee approvals ──
  const fetchEmployeeApprovals = useCallback(() => {
    let url = "/api/approvals?type=employee&status=pending";
    // department_approver only sees their department (enforced by API)
    fetch(url, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const items = data.data ?? [];
        setEmployeeApprovals(
          items.map((a: any) => ({
            id: a.id,
            employeeId: a.employee?.id || "",
            employeeName: a.employee?.fullName || "",
            contractorName: a.employee?.organization?.name || "",
            department: a.department,
            departmentName: DEPARTMENT_NAMES[a.department] || a.department,
            status: a.status,
            deadline: a.deadline,
            comment: a.comment,
            position: a.employee?.position || "",
            workClasses: a.employee?.workClasses || [],
          }))
        );
      })
      .catch(() => {});
  }, []);

  // ── Fetch permit approvals (admin only) ──
  const fetchPermitApprovals = useCallback(() => {
    fetch("/api/approvals/permits?status=pending_approval", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setPermitApprovals(data.data ?? []);
      })
      .catch(() => {});
  }, []);

  // ── Initial data load ──
  useEffect(() => {
    if (!role) return;
    setLoading(true);

    if (role === "admin") {
      // Fetch both permit and employee approvals in parallel
      Promise.all([
        fetch("/api/approvals/permits?status=pending_approval", { credentials: "include" })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => { if (data) setPermitApprovals(data.data ?? []); })
          .catch(() => {}),
        fetch("/api/approvals?type=employee&status=pending", { credentials: "include" })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (!data) return;
            const items = data.data ?? [];
            setEmployeeApprovals(
              items.map((a: any) => ({
                id: a.id,
                employeeId: a.employee?.id || "",
                employeeName: a.employee?.fullName || "",
                contractorName: a.employee?.organization?.name || "",
                department: a.department,
                departmentName: DEPARTMENT_NAMES[a.department] || a.department,
                status: a.status,
                deadline: a.deadline,
                comment: a.comment,
                position: a.employee?.position || "",
                workClasses: a.employee?.workClasses || [],
              }))
            );
          })
          .catch(() => {}),
      ]).then(() => setLoading(false));
    } else {
      fetchEmployeeApprovals();
      setLoading(false);
    }
  }, [role]);

  // Re-fetch when main tab changes (admin)
  useEffect(() => {
    if (role !== "admin") return;
    if (mainTab === "permits") {
      fetchPermitApprovals();
    } else {
      fetchEmployeeApprovals();
    }
  }, [mainTab, role, fetchPermitApprovals, fetchEmployeeApprovals]);

  // ── Decision submission ──
  async function submitDecision() {
    if (dialogMode === "reject" && !dialogComment.trim()) {
      setError("При отклонении обязателен комментарий");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const endpoint =
        dialogType === "permit"
          ? `/api/approvals/permits/${dialogApprovalId}`
          : `/api/approvals/${dialogApprovalId}`;

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: dialogMode === "approve" ? "approved" : "rejected",
          comment: dialogComment.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ошибка при сохранении решения");
        return;
      }

      // Remove from local list
      if (dialogType === "permit") {
        setPermitApprovals((prev) => prev.filter((p) => p.id !== dialogApprovalId));
      } else {
        setEmployeeApprovals((prev) => prev.filter((a) => a.id !== dialogApprovalId));
      }
      setDialogOpen(false);
    } catch {
      setError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  function openEmployeeDialog(id: string, mode: "approve" | "reject") {
    setDialogApprovalId(id);
    setDialogMode(mode);
    setDialogType("employee");
    setDialogComment("");
    setError("");
    setDialogOpen(true);
  }

  function openPermitDialog(id: string, mode: "approve" | "reject") {
    setDialogApprovalId(id);
    setDialogMode(mode);
    setDialogType("permit");
    setDialogComment("");
    setError("");
    setDialogOpen(true);
  }

  const canDecide = role === "admin" || role === "department_approver";
  const isAdmin = role === "admin";
  const isDeptApprover = role === "department_approver";

  // ── Forbidden state ──
  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-lg text-zinc-600">Нет доступа к разделу согласований</p>
        <Button variant="outline" onClick={() => router.push("/")}>
          На главную
        </Button>
      </div>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  // ── Filter employee approvals by department tab ──
  const filteredEmployeeApprovals = employeeApprovals.filter((a) => {
    if (isAdmin) return a.department === deptTab;
    if (isDeptApprover) return a.department === deptTab;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Согласования
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {isAdmin
            ? "Управление согласованиями нарядов-допусков и сотрудников"
            : isDeptApprover
              ? `Согласование сотрудников — ${DEPARTMENT_NAMES[deptTab] || deptTab}`
              : "Статус заявок на согласование сотрудников вашей организации"}
        </p>
      </div>

      {/* ── Admin: main toggle (Permits / Employees) ── */}
      {isAdmin && (
        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 w-fit">
          <button
            onClick={() => setMainTab("permits")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              mainTab === "permits"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            Наряды-допуски
          </button>
          <button
            onClick={() => setMainTab("employees")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              mainTab === "employees"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            Сотрудники
          </button>
        </div>
      )}

      {/* ── Admin employees tab or department_approver: department sub-tabs ── */}
      {(mainTab === "employees" || isDeptApprover) && (
        <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-100 p-1">
          {DEPARTMENT_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setDeptTab(key)}
              disabled={isDeptApprover && deptTab !== key}
              className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                deptTab === key
                  ? "bg-white text-zinc-900 shadow-sm"
                  : isDeptApprover && deptTab !== key
                    ? "text-zinc-300 cursor-not-allowed"
                    : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {DEPARTMENT_NAMES[key]}
            </button>
          ))}
        </div>
      )}

      {/* ── Permits table (admin, mainTab=permits) ── */}
      {isAdmin && mainTab === "permits" && (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-medium">Номер наряда</TableHead>
                <TableHead className="font-medium">Подрядчик</TableHead>
                <TableHead className="font-medium">Участок</TableHead>
                <TableHead className="font-medium">Ответственный</TableHead>
                <TableHead className="font-medium">Дата открытия</TableHead>
                <TableHead className="font-medium">Срок</TableHead>
                <TableHead className="font-medium">Статус</TableHead>
                {canDecide && (
                  <TableHead className="font-medium text-right">Действия</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {permitApprovals.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canDecide ? 8 : 7}
                    className="py-8 text-center text-sm text-zinc-500"
                  >
                    Нет нарядов-допусков на согласовании
                  </TableCell>
                </TableRow>
              ) : (
                permitApprovals.map((permit) => (
                  <TableRow key={permit.id}>
                    <TableCell className="font-medium text-zinc-900">
                      <Link href={`/permits/${permit.id}`} className="hover:text-blue-600 transition-colors">
                        {sanitize(permit.permitNumber)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-zinc-600">
                      {sanitize(permit.contractor.name)}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600">
                      {sanitize(permit.workSite)}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600">
                      {sanitize(permit.responsiblePerson)}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600 font-mono">
                      {formatDate(permit.openDate)}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600 font-mono">
                      {formatDate(permit.expiryDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={permitStatusConfig[permit.status]?.variant ?? "outline"}>
                        {permitStatusConfig[permit.status]?.label ?? permit.status}
                      </Badge>
                    </TableCell>
                    {canDecide && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                            onClick={() => openPermitDialog(permit.id, "approve")}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Согласовать
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-700 border-red-200 hover:bg-red-50"
                            onClick={() => openPermitDialog(permit.id, "reject")}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Отклонить
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Employee approvals table ── */}
      {(mainTab === "employees" || isDeptApprover) && (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-medium">Сотрудник</TableHead>
                <TableHead className="font-medium">Подрядчик</TableHead>
                <TableHead className="font-medium">Должность</TableHead>
                <TableHead className="font-medium">Классы работ</TableHead>
                <TableHead className="font-medium">Срок</TableHead>
                <TableHead className="font-medium">Статус</TableHead>
                {canDecide && (
                  <TableHead className="font-medium text-right">Действия</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployeeApprovals.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canDecide ? 7 : 6}
                    className="py-8 text-center text-sm text-zinc-500"
                  >
                    Запросы на согласование не найдены
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployeeApprovals.map((approval) => (
                  <TableRow key={approval.id}>
                    <TableCell className="font-medium text-zinc-900">
                      <Link href={`/employees/${approval.employeeId}`} className="hover:text-blue-600 transition-colors">
                        {sanitize(approval.employeeName)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-zinc-600">
                      {sanitize(approval.contractorName)}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600">
                      {approval.position ? sanitize(approval.position) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600">
                      {approval.workClasses && approval.workClasses.length > 0
                        ? approval.workClasses.map((wc) => wc.workClass).join(", ")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600 font-mono">
                      {formatDate(approval.deadline)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[approval.status].variant}>
                        {statusConfig[approval.status].label}
                      </Badge>
                    </TableCell>
                    {canDecide && (
                      <TableCell className="text-right">
                        {approval.status === "pending" ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                              onClick={() =>
                                openEmployeeDialog(approval.id, "approve")
                              }
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Согласовать
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-700 border-red-200 hover:bg-red-50"
                              onClick={() =>
                                openEmployeeDialog(approval.id, "reject")
                              }
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Отклонить
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400">
                            {approval.comment || "—"}
                          </span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Decision Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "approve" ? "Согласовать" : "Отклонить"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "approve"
                ? `Подтвердите согласование${dialogType === "permit" ? " наряда-допуска" : " сотрудника"}`
                : `Укажите причину отклонения${dialogType === "permit" ? " наряда-допуска" : ""}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Комментарий</Label>
              <Textarea
                placeholder={
                  dialogMode === "reject"
                    ? "Причина отклонения..."
                    : "Комментарий (необязательно)"
                }
                value={dialogComment}
                onChange={(e) => setDialogComment(e.target.value)}
                rows={3}
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Отмена
            </Button>
            <Button
              onClick={submitDecision}
              disabled={submitting}
              variant={dialogMode === "reject" ? "destructive" : "default"}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialogMode === "approve" ? "Согласовать" : "Отклонить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
