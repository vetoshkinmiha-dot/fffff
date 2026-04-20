"use client";

import { useState, useEffect, useCallback } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, XCircle, Send, Plus, Loader2, Pencil, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "@/components/employees/file-upload";
import { Separator } from "@/components/ui/separator";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { cn, sanitize } from "@/lib/utils";

interface Employee {
  id: string;
  fullName: string;
  position: string;
  photoUrl: string | null;
  passportSeries: string;
  passportNumber: string;
  passportIssuedBy: string | null;
  passportIssueDate: string | null;
  workClasses: string[];
  previouslyAtPirelli: boolean;
  organization: { id: string; name: string; sequentialNumber: number };
  documents: {
    id: string;
    name: string;
    fileUrl: string | null;
    issueDate: string | null;
    expiryDate: string | null;
    status: string;
    createdAt: string;
  }[];
  approvals: {
    id: string;
    department: string;
    status: string;
    deadline: string;
    comment: string | null;
    createdAt: string;
  }[];
}

const DEPARTMENT_NAMES: Record<string, string> = {
  security: "Служба безопасности",
  hr: "Отдел кадров",
  safety: "Охрана труда",
  safety_training: "Вводный инструктаж",
  permit_bureau: "Бюро пропусков/СБ",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateWithTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          Согласовано
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-red-700">
          <XCircle className="h-4 w-4" />
          Отклонено
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-700">
          <Clock className="h-4 w-4" />
          На рассмотрении
        </span>
      );
    case "blocked":
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-zinc-400">
          <Clock className="h-4 w-4" />
          Заблокирован
        </span>
      );
    default:
      return null;
  }
}

function getApprovalBadge(approval: { status: string }) {
  switch (approval.status) {
    case "approved":
      return <Badge className="bg-green-600 text-white">Согласовано</Badge>;
    case "rejected":
      return <Badge variant="destructive">Отклонено</Badge>;
    case "pending":
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">Ожидает</Badge>;
    case "blocked":
      return <Badge variant="outline" className="bg-zinc-100 text-zinc-500 border-zinc-200">Заблокирован</Badge>;
    default:
      return null;
  }
}

function DocStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "valid":
      return (
        <Badge
          variant="default"
          className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
        >
          Действует
        </Badge>
      );
    case "expiring":
      return (
        <Badge
          variant="secondary"
          className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
        >
          Истекает
        </Badge>
      );
    case "expired":
      return <Badge variant="destructive">Истёк</Badge>;
    default:
      return null;
  }
}

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [showUpload, setShowUpload] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState("");

  // Edit own employee (contractor_admin only)
  const [editingOwn, setEditingOwn] = useState(false);
  const [savingOwn, setSavingOwn] = useState(false);
  const [editOwnError, setEditOwnError] = useState("");
  const [ownForm, setOwnForm] = useState({
    fullName: "",
    position: "",
    passportSeries: "",
    passportNumber: "",
    passportIssuedBy: "",
    passportIssueDate: "",
  });

  // Admin edit/delete employee
  const isAdminEdit = userRole === "admin";
  const [adminEditOpen, setAdminEditOpen] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminEditError, setAdminEditError] = useState("");
  const [adminForm, setAdminForm] = useState({
    fullName: "",
    position: "",
    passportSeries: "",
    passportNumber: "",
    passportIssuedBy: "",
    passportIssueDate: "",
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ type: "employee" | "doc"; id: string; name: string } | null>(null);

  const [authEmployeeId, setAuthEmployeeId] = useState<string | null>(null);

  // Determine if current user is viewing their own employee record (contractor_admin + contractor_employee)
  const isOwnRecord = (userRole === "contractor_admin" || userRole === "contractor_employee") && authEmployeeId === id;

  const DEPARTMENTS: { key: string; label: string }[] = [
    { key: "security", label: "Служба безопасности" },
    { key: "hr", label: "Отдел кадров" },
    { key: "safety", label: "Охрана труда" },
    { key: "safety_training", label: "Вводный инструктаж" },
    { key: "permit_bureau", label: "Бюро пропусков/СБ" },
  ];

  function toggleDept(key: string) {
    setSelectedDepts((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
    );
  }

  async function submitApproval() {
    if (!id) return;
    if (selectedDepts.length === 0) {
      setApprovalError("Выберите хотя бы один департамент");
      return;
    }
    if (!deadline) {
      setApprovalError("Укажите срок");
      return;
    }
    setSubmittingApproval(true);
    setApprovalError("");
    try {
      const res = await fetch(`/api/employees/${id}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          departments: selectedDepts,
          deadline: new Date(deadline).toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setApprovalError(data.error || "Ошибка при отправке на согласование");
        return;
      }
      // Refresh employee data
      const empRes = await fetch(`/api/employees/${id}`, { credentials: "include" });
      if (empRes.ok) setEmployee(await empRes.json());
      setApprovalDialogOpen(false);
      setSelectedDepts([]);
      setDeadline("");
    } catch {
      setApprovalError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setSubmittingApproval(false);
    }
  }

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  async function saveOwnProfile() {
    if (!id || !ownForm.fullName.trim() || !ownForm.position.trim()) {
      setEditOwnError("ФИО и должность обязательны");
      return;
    }
    setSavingOwn(true);
    setEditOwnError("");
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fullName: ownForm.fullName.trim(),
          position: ownForm.position.trim(),
          passportSeries: ownForm.passportSeries.trim() || undefined,
          passportNumber: ownForm.passportNumber.trim() || undefined,
          passportIssuedBy: ownForm.passportIssuedBy.trim() || null,
          passportIssueDate: ownForm.passportIssueDate ? new Date(ownForm.passportIssueDate).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditOwnError(data.error || "Ошибка при сохранении");
        return;
      }
      const updated = await res.json();
      setEmployee(updated);
      setEditingOwn(false);
    } catch {
      setEditOwnError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setSavingOwn(false);
    }
  }

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.role) setUserRole(data.user.role);
        if (data?.user?.employeeId) setAuthEmployeeId(data.user.employeeId);
      })
      .catch(() => {});
  }, []);

  // Populate edit form when viewing own record
  useEffect(() => {
    if (isOwnRecord && employee) {
      setOwnForm({
        fullName: employee.fullName,
        position: employee.position,
        passportSeries: employee.passportSeries,
        passportNumber: employee.passportNumber,
        passportIssuedBy: employee.passportIssuedBy || "",
        passportIssueDate: employee.passportIssueDate ? employee.passportIssueDate.split("T")[0] : "",
      });
    }
  }, [isOwnRecord, employee]);

  // Populate admin edit form
  useEffect(() => {
    if (adminEditOpen && employee) {
      setAdminForm({
        fullName: employee.fullName,
        position: employee.position,
        passportSeries: employee.passportSeries,
        passportNumber: employee.passportNumber,
        passportIssuedBy: employee.passportIssuedBy || "",
        passportIssueDate: employee.passportIssueDate ? employee.passportIssueDate.split("T")[0] : "",
      });
    }
  }, [adminEditOpen, employee]);

  async function saveAdminEdit() {
    if (!id || !adminForm.fullName.trim() || !adminForm.position.trim()) {
      setAdminEditError("ФИО и должность обязательны");
      return;
    }
    setSavingAdmin(true);
    setAdminEditError("");
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fullName: adminForm.fullName.trim(),
          position: adminForm.position.trim(),
          passportSeries: adminForm.passportSeries.trim() || undefined,
          passportNumber: adminForm.passportNumber.trim() || undefined,
          passportIssuedBy: adminForm.passportIssuedBy.trim() || null,
          passportIssueDate: adminForm.passportIssueDate ? new Date(adminForm.passportIssueDate).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setAdminEditError(data.error || "Ошибка при сохранении");
        return;
      }
      const updated = await res.json();
      setEmployee(updated);
      setAdminEditOpen(false);
    } catch {
      setAdminEditError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setSavingAdmin(false);
    }
  }

  async function deleteEmployee() {
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.error || "Ошибка при удалении");
        return;
      }
      window.location.href = "/employees";
    } catch {
      setDeleteError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setDeleting(false);
    }
  }

  async function deleteDocument() {
    if (!deleteTarget || deleteTarget.type !== "doc" || !id) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/employees/${id}/documents/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.error || "Ошибка при удалении");
        return;
      }
      // Refresh employee data
      const empRes = await fetch(`/api/employees/${id}`, { credentials: "include" });
      if (empRes.ok) setEmployee(await empRes.json());
      setDeleteTarget(null);
    } catch {
      setDeleteError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (!id) return;

    async function fetchEmployee() {
      setLoading(true);
      try {
        const [res, userRes] = await Promise.all([
          fetch(`/api/employees/${id}`, { credentials: "include" }),
          fetch("/api/auth/me", { credentials: "include" }),
        ]);
        if (res.status === 404) {
          setEmployee(null);
        } else if (res.status === 401) {
          window.location.href = "/login";
        } else if (res.ok) {
          setEmployee(await res.json());
        }
        if (userRes.ok) {
          const userData = await userRes.json();
          setUserRole(userData.user?.role || "");
        }
      } catch {
        setEmployee(null);
      } finally {
        setLoading(false);
      }
    }

    fetchEmployee();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-sm text-zinc-500">Загрузка...</span>
      </div>
    );
  }

  if (!employee) {
    notFound();
  }

  const cleanName = sanitize(employee.fullName);
  const initials = cleanName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");

  const approvedCount = employee.approvals.filter(
    (a) => a.status === "approved"
  ).length;
  const totalStages = employee.approvals.length;

  // Departments that already have an approval request (any status)
  const requestedDeptKeys = new Set(employee.approvals.map((a) => a.department));
  const remainingDepts = DEPARTMENTS.filter((d) => !requestedDeptKeys.has(d.key));
  const allRequested = remainingDepts.length === 0;

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center gap-4">
        <Link href="/employees" className="inline-flex items-center">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Назад к списку
          </Button>
        </Link>
        <div className="flex-1" />
        {(userRole === "admin" || userRole === "contractor_admin") && !allRequested && (
          <Button className="gap-2" onClick={() => setApprovalDialogOpen(true)}>
            <Send className="h-4 w-4" />
            Отправить на согласование
          </Button>
        )}
      </div>

      {/* Employee header */}
      <Card>
        <CardHeader className={(isOwnRecord || isAdminEdit) ? "flex flex-row items-center justify-between" : undefined}>
          <CardTitle className="text-base">Личные данные</CardTitle>
          <div className="flex gap-2">
          {isOwnRecord && !editingOwn && (
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditingOwn(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Редактировать
            </Button>
          )}
          {isAdminEdit && !adminEditOpen && (
            <>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setAdminEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Редактировать
              </Button>
              <Button variant="outline" size="sm" className="gap-1 text-red-600 hover:text-red-700" onClick={() => setDeleteTarget({ type: "employee", id: id!, name: cleanName })}>
                <Trash2 className="h-3.5 w-3.5" />
                Удалить
              </Button>
            </>
          )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {!editingOwn ? (
          <div className="flex items-start gap-5">
            {/* Photo placeholder */}
            {employee.photoUrl ? (
              <img
                src={employee.photoUrl}
                alt={cleanName}
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-blue-600 text-2xl font-semibold text-white">
                {initials}
              </div>
            )}

            <div className="space-y-1 min-w-0">
              <h1 className="text-xl font-semibold text-zinc-900">
                {cleanName}
              </h1>
              <p className="text-sm text-zinc-500">{sanitize(employee.position)}</p>
              <p className="text-sm text-zinc-500">
                Паспорт: {employee.passportSeries} {employee.passportNumber}
              </p>
              {employee.passportIssuedBy && (
                <p className="text-sm text-zinc-500">
                  Кем выдан: {employee.passportIssuedBy}
                </p>
              )}
              {employee.passportIssueDate && (
                <p className="text-sm text-zinc-500">
                  Когда выдан: {new Date(employee.passportIssueDate).toLocaleDateString("ru-RU")}
                </p>
              )}
              {employee.previouslyAtPirelli && (
                <Badge variant="outline" className="text-xs">
                  Ранее работал в Pirelli
                </Badge>
              )}
            </div>

            <div className="ml-auto shrink-0 text-right">
              <p className="text-sm text-zinc-500">Согласования</p>
              <p className="text-2xl font-semibold text-zinc-900">
                {approvedCount}/{totalStages}
              </p>
            </div>
          </div>
          ) : (
          <div className="space-y-4">
            {editOwnError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {editOwnError}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>ФИО</Label>
                <Input
                  value={ownForm.fullName}
                  onChange={(e) => setOwnForm({ ...ownForm, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Должность</Label>
                <Input
                  value={ownForm.position}
                  onChange={(e) => setOwnForm({ ...ownForm, position: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Серия паспорта</Label>
                <Input
                  value={ownForm.passportSeries}
                  onChange={(e) => setOwnForm({ ...ownForm, passportSeries: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Номер паспорта</Label>
                <Input
                  value={ownForm.passportNumber}
                  onChange={(e) => setOwnForm({ ...ownForm, passportNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Кем выдан</Label>
                <Input
                  value={ownForm.passportIssuedBy}
                  onChange={(e) => setOwnForm({ ...ownForm, passportIssuedBy: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Когда выдан</Label>
                <Input
                  type="date"
                  value={ownForm.passportIssueDate}
                  onChange={(e) => setOwnForm({ ...ownForm, passportIssueDate: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveOwnProfile} disabled={savingOwn}>
                {savingOwn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Сохранить
              </Button>
              <Button variant="outline" onClick={() => { setEditingOwn(false); setEditOwnError(""); }} disabled={savingOwn}>
                Отмена
              </Button>
            </div>
          </div>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Документы</CardTitle>
          {(userRole === "admin" || userRole === "contractor_admin" || userRole === "contractor_employee") && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setShowUpload((v) => !v)}
          >
            <Plus className="h-4 w-4" />
            Загрузить
          </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {showUpload && id && (
            <div className="px-6 pb-4">
              <FileUpload
                employeeId={id}
                onUploaded={(doc) => {
                  setEmployee((prev) =>
                    prev
                      ? { ...prev, documents: [...prev.documents, doc] }
                      : prev
                  );
                  setShowUpload(false);
                }}
              />
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Документ</TableHead>
                <TableHead>Дата выдачи</TableHead>
                <TableHead>Действует до</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="w-16">Файл</TableHead>
                {isAdminEdit && <TableHead className="w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {employee.documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.name}</TableCell>
                  <TableCell>{formatDate(doc.issueDate)}</TableCell>
                  <TableCell>{formatDate(doc.expiryDate)}</TableCell>
                  <TableCell>
                    <DocStatusBadge status={doc.status} />
                  </TableCell>
                  <TableCell>
                    {doc.fileUrl ? (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Файл
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </TableCell>
                  {isAdminEdit && (
                    <TableCell>
                      <button
                        onClick={() => setDeleteTarget({ type: "doc", id: doc.id, name: doc.name })}
                        className="text-zinc-400 hover:text-red-600 transition-colors"
                        title="Удалить документ"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {employee.documents.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={isAdminEdit ? 6 : 5}
                    className="py-6 text-center text-sm text-zinc-500"
                  >
                    Документы не загружены
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Work classes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Классы работ</CardTitle>
        </CardHeader>
        <CardContent>
          {employee.workClasses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Класс работ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employee.workClasses.map((wc) => (
                  <TableRow key={wc}>
                    <TableCell>{wc}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <span className="text-sm text-zinc-500">Классы работ не назначены</span>
          )}
        </CardContent>
      </Card>

      {/* Approval pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Маршрут согласования</CardTitle>
          <p className="text-sm text-zinc-500">
            Последовательные этапы допуска сотрудника к работам
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {employee.approvals.map((approval, index) => {
              const isLast = index === employee.approvals.length - 1;
              const connectorColor =
                approval.status === "approved"
                  ? "bg-green-400"
                  : approval.status === "rejected"
                  ? "bg-red-400"
                  : approval.status === "blocked"
                  ? "bg-zinc-200"
                  : "bg-zinc-300";

              return (
                <div key={approval.id} className="flex gap-3">
                  {/* Timeline column */}
                  <div className="flex flex-col items-center w-8 shrink-0">
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                        approval.status === "approved" &&
                          "border-green-500 bg-green-500 text-white",
                        approval.status === "rejected" &&
                          "border-red-500 bg-red-500 text-white",
                        approval.status === "pending" &&
                          "border-zinc-300 bg-zinc-100 text-zinc-400",
                        approval.status === "blocked" &&
                          "border-zinc-200 bg-zinc-50 text-zinc-300"
                      )}
                    >
                      {approval.status === "approved" && (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {approval.status === "rejected" && (
                        <XCircle className="h-4 w-4" />
                      )}
                      {approval.status === "pending" && (
                        <Clock className="h-4 w-4" />
                      )}
                      {approval.status === "blocked" && (
                        <Clock className="h-4 w-4" />
                      )}
                    </div>
                    {!isLast && (
                      <div
                        className={cn("w-0.5 h-6 shrink-0", connectorColor)}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-5 pt-0.5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">
                          {DEPARTMENT_NAMES[approval.department] ?? approval.department}
                        </p>
                        {approval.comment && (
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {approval.comment}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-xs text-zinc-500">
                        <span className="whitespace-nowrap">Срок: {formatDateWithTime(approval.deadline)}</span>
                        {getApprovalBadge(approval)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {employee.approvals.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-4">
                Согласование не инициировано
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit approval dialog (Task 3.1) */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отправить на согласование</DialogTitle>
            <DialogDescription>
              {remainingDepts.length < DEPARTMENTS.length
                ? `Осталось согласовать ${remainingDepts.length} из ${DEPARTMENTS.length} департаментов`
                : "Выберите департаменты и укажите срок"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Департаменты</Label>
              {remainingDepts.map((dept) => (
                <div key={dept.key} className="flex items-center gap-2">
                  <Checkbox
                    id={dept.key}
                    checked={selectedDepts.includes(dept.key)}
                    onCheckedChange={() => toggleDept(dept.key)}
                  />
                  <Label htmlFor={dept.key} className="text-sm cursor-pointer">
                    {dept.label}
                  </Label>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="approvalDeadline">Срок</Label>
              <Input
                id="approvalDeadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            {approvalError && (
              <p className="text-sm text-red-600">{approvalError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setApprovalDialogOpen(false); setApprovalError(""); }}
              disabled={submittingApproval}
            >
              Отмена
            </Button>
            <Button onClick={submitApproval} disabled={submittingApproval}>
              {submittingApproval && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Отправить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin edit employee dialog */}
      <Dialog open={adminEditOpen} onOpenChange={setAdminEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать сотрудника</DialogTitle>
            <DialogDescription>
              Измените данные сотрудника
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {adminEditError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {adminEditError}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>ФИО *</Label>
                <Input
                  value={adminForm.fullName}
                  onChange={(e) => setAdminForm({ ...adminForm, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Должность *</Label>
                <Input
                  value={adminForm.position}
                  onChange={(e) => setAdminForm({ ...adminForm, position: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Серия паспорта</Label>
                <Input
                  value={adminForm.passportSeries}
                  onChange={(e) => setAdminForm({ ...adminForm, passportSeries: e.target.value })}
                  placeholder="4 цифры"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Номер паспорта</Label>
                <Input
                  value={adminForm.passportNumber}
                  onChange={(e) => setAdminForm({ ...adminForm, passportNumber: e.target.value })}
                  placeholder="6 цифр"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Кем выдан</Label>
                <Input
                  value={adminForm.passportIssuedBy}
                  onChange={(e) => setAdminForm({ ...adminForm, passportIssuedBy: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Когда выдан</Label>
                <Input
                  type="date"
                  value={adminForm.passportIssueDate}
                  onChange={(e) => setAdminForm({ ...adminForm, passportIssueDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAdminEditOpen(false); setAdminEditError(""); }} disabled={savingAdmin}>
              Отмена
            </Button>
            <Button onClick={saveAdminEdit} disabled={savingAdmin}>
              {savingAdmin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog (employee or document) */}
      <Dialog open={!!deleteTarget || deleteDialogOpen} onOpenChange={(open) => {
        if (!open) { setDeleteDialogOpen(false); setDeleteTarget(null); setDeleteError(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.type === "doc" ? "Удалить документ" : "Удалить сотрудника"}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.type === "doc"
                ? `Удалить документ «${deleteTarget.name}»? Это действие нельзя отменить.`
                : `Вы уверены, что хотите удалить сотрудника ${cleanName}? Это действие нельзя отменить.`}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setDeleteTarget(null); setDeleteError(""); }} disabled={deleting}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={deleteTarget?.type === "doc" ? deleteDocument : deleteEmployee} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
