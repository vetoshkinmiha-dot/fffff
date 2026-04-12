"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { sanitize } from "@/lib/utils";

interface Approval {
  id: string;
  employeeName: string;
  contractorName: string;
  department: string;
  departmentName: string;
  status: "pending" | "approved" | "rejected";
  deadline: string;
  comment: string | null;
  createdAt: string;
}

const statusConfig: Record<
  string,
  { variant: "outline" | "default" | "secondary"; label: string }
> = {
  pending: { variant: "secondary", label: "Ожидает" },
  approved: { variant: "default", label: "Согласовано" },
  rejected: { variant: "secondary", label: "Отклонено" },
};

const DEPARTMENT_NAMES: Record<string, string> = {
  security: "Служба безопасности",
  hr: "Отдел кадров",
  safety: "Охрана труда",
  safety_training: "Вводный инструктаж",
  permit_bureau: "Бюро пропусков",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ApprovalsPage() {
  const router = useRouter();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"approve" | "reject">("approve");
  const [dialogComment, setDialogComment] = useState("");
  const [dialogApprovalId, setDialogApprovalId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.role) {
          setRole(data.user.role);
          // employee role should redirect
          if (data.user.role === "employee") {
            router.replace("/");
          }
        }
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    const statusParam = statusFilter === "all" ? "" : statusFilter;
    const url = statusParam
      ? `/api/approvals?status=${statusParam}`
      : "/api/approvals";
    fetch(url, { credentials: "include" })
      .then((r) => {
        if (r.status === 403) {
          setForbidden(true);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) {
          setLoading(false);
          return;
        }
        setApprovals(
          data.map((a: any) => ({
            id: a.id,
            employeeName: a.employee?.fullName || "",
            contractorName: a.employee?.organization?.name || "",
            department: a.department,
            departmentName: DEPARTMENT_NAMES[a.department] || a.department,
            status: a.status,
            deadline: a.deadline,
            comment: a.comment,
            createdAt: a.createdAt,
          }))
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [statusFilter]);

  const handleStatusChange = useCallback((value: string | null) => {
    setStatusFilter(value ?? "pending");
  }, []);

  function openDialog(id: string, mode: "approve" | "reject") {
    setDialogApprovalId(id);
    setDialogMode(mode);
    setDialogComment("");
    setError("");
    setDialogOpen(true);
  }

  async function submitDecision() {
    if (dialogMode === "reject" && !dialogComment.trim()) {
      setError("При отклонении обязателен комментарий");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/approvals/${dialogApprovalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: dialogMode,
          comment: dialogComment.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ошибка при сохранении решения");
        return;
      }

      setApprovals((prev) =>
        prev.map((a) =>
          a.id === dialogApprovalId
            ? {
                ...a,
                status: dialogMode === "approve" ? "approved" : "rejected",
                comment: dialogComment.trim() || null,
              }
            : a
        )
      );
      setDialogOpen(false);
    } catch {
      setError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  const canDecide =
    role === "admin" || role === "department_approver";

  const filtered =
    statusFilter === "all"
      ? approvals
      : approvals.filter((a) => a.status === statusFilter);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  const isContractor = role === "contractor_employee";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Согласования
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {isContractor
            ? "Статус заявок на согласование сотрудников вашей организации"
            : "Управление допусками сотрудников подрядных организаций"}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Все статусы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Ожидающие</SelectItem>
            <SelectItem value="approved">Согласованные</SelectItem>
            <SelectItem value="rejected">Отклонённые</SelectItem>
            <SelectItem value="all">Все</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-medium">Сотрудник</TableHead>
              <TableHead className="font-medium">Подрядчик</TableHead>
              <TableHead className="font-medium">Департамент</TableHead>
              <TableHead className="font-medium">Срок</TableHead>
              <TableHead className="font-medium">Статус</TableHead>
              {canDecide && (
                <TableHead className="font-medium text-right">
                  Действия
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canDecide ? 6 : 5}
                  className="py-8 text-center text-sm text-zinc-500"
                >
                  {isContractor
                    ? "Сотрудников на согласование не найдено"
                    : "Запросы на согласование не найдены"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((approval) => (
                <TableRow key={approval.id}>
                  <TableCell className="font-medium text-zinc-900">
                    {sanitize(approval.employeeName)}
                  </TableCell>
                  <TableCell className="text-zinc-600">
                    {sanitize(approval.contractorName)}
                  </TableCell>
                  <TableCell className="text-sm text-zinc-600">
                    {approval.departmentName}
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
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() =>
                              openDialog(approval.id, "approve")
                            }
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() =>
                              openDialog(approval.id, "reject")
                            }
                          >
                            <XCircle className="h-4 w-4" />
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

      {/* Decision Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "approve" ? "Согласовать" : "Отклонить"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "approve"
                ? "Подтвердите согласование сотрудника"
                : "Укажите причину отклонения"}
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
