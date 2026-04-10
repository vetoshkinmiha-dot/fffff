"use client";

import { useState, useEffect, useCallback } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, XCircle, Send, Plus, Loader2 } from "lucide-react";
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
  const [showUpload, setShowUpload] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState("");

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

  useEffect(() => {
    if (!id) return;

    async function fetchEmployee() {
      setLoading(true);
      try {
        const res = await fetch(`/api/employees/${id}`, { credentials: "include" });
        if (res.status === 404) {
          setEmployee(null);
        } else if (res.status === 401) {
          window.location.href = "/login";
        } else if (res.ok) {
          setEmployee(await res.json());
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
        <Button className="gap-2" onClick={() => setApprovalDialogOpen(true)}>
          <Send className="h-4 w-4" />
          Отправить на согласование
        </Button>
      </div>

      {/* Employee header */}
      <Card>
        <CardContent className="pt-6">
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
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Документы</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setShowUpload((v) => !v)}
          >
            <Plus className="h-4 w-4" />
            Загрузить
          </Button>
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
                </TableRow>
              ))}
              {employee.documents.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
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
          <div className="flex flex-wrap gap-2">
            {employee.workClasses.map((wc) => (
              <Badge
                key={wc}
                variant="outline"
                className="rounded-lg border-blue-200 bg-blue-50 text-blue-800 px-3 py-1.5 text-sm"
              >
                {wc}
              </Badge>
            ))}
            {employee.workClasses.length === 0 && (
              <span className="text-sm text-zinc-500">Классы работ не назначены</span>
            )}
          </div>
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
                  : "bg-zinc-300";

              return (
                <div key={approval.id} className="flex gap-4">
                  {/* Timeline column */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                        approval.status === "approved" &&
                          "border-green-500 bg-green-500 text-white",
                        approval.status === "rejected" &&
                          "border-red-500 bg-red-500 text-white",
                        approval.status === "pending" &&
                          "border-zinc-300 bg-zinc-100 text-zinc-400"
                      )}
                    >
                      {approval.status === "approved" && (
                        <CheckCircle2 className="h-5 w-5" />
                      )}
                      {approval.status === "rejected" && (
                        <XCircle className="h-5 w-5" />
                      )}
                      {approval.status === "pending" && (
                        <Clock className="h-4 w-4" />
                      )}
                    </div>
                    {!isLast && (
                      <div
                        className={cn("w-0.5 flex-1 min-h-[32px]", connectorColor)}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className={cn("pb-8 flex-1", isLast && "pb-0")}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">
                          {DEPARTMENT_NAMES[approval.department] ?? approval.department}
                        </p>
                        {approval.comment && (
                          <p className="mt-0.5 text-sm text-zinc-500">
                            {approval.comment}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-sm text-zinc-500">
                        <span>Срок: {formatDate(approval.deadline)}</span>
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
              Выберите департаменты и укажите срок
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Департаменты</Label>
              {DEPARTMENTS.map((dept) => (
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
    </div>
  );
}
