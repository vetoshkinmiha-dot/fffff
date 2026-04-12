"use client";

import { useState, useEffect } from "react";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, XCircle, Printer, Archive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
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
  closeReason: string | null;
  closedAt: string | null;
  contractor: { name: string; sequentialNumber: number };
  approvals: {
    id: string;
    department: string;
    status: string;
    deadline: string;
    comment: string | null;
    createdAt: string;
  }[];
}

export default function PermitDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [permit, setPermit] = useState<Permit | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState("");

  // Approval decision state
  const [decisionApprovalId, setDecisionApprovalId] = useState<string | null>(null);
  const [decisionAction, setDecisionAction] = useState<"approved" | "rejected" | null>(null);
  const [decisionComment, setDecisionComment] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [decisionError, setDecisionError] = useState("");

  useEffect(() => {
    async function fetchPermit() {
      setLoading(true);
      try {
        const [res, userRes] = await Promise.all([
          fetch(`/api/permits/${id}`, { credentials: "include" }),
          fetch("/api/auth/me", { credentials: "include" }),
        ]);
        if (res.status === 404) {
          notFound();
        } else if (res.ok) {
          setPermit(await res.json());
        }
        if (userRes.ok) {
          const userData = await userRes.json();
          setUserRole(userData.user?.role || "");
        }
      } catch {
        notFound();
      } finally {
        setLoading(false);
      }
    }
    fetchPermit();
  }, [id]);

  async function handleDecision() {
    if (!decisionApprovalId || !decisionAction) return;
    if (decisionAction === "rejected" && !decisionComment.trim()) {
      setDecisionError("Комментарий обязателен при отклонении");
      return;
    }
    setDeciding(true);
    setDecisionError("");
    try {
      const res = await fetch(`/api/permits/${id}/approvals/${decisionApprovalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: decisionAction,
          comment: decisionComment.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setDecisionError(data.error || "Ошибка при согласовании");
        return;
      }
      const updated = await fetch(`/api/permits/${id}`, { credentials: "include" });
      if (updated.ok) setPermit(await updated.json());
      setDecisionApprovalId(null);
      setDecisionAction(null);
      setDecisionComment("");
      setDecisionError("");
    } catch {
      setDecisionError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setDeciding(false);
    }
  }

  async function handleClosePermit() {
    if (!closeReason.trim()) {
      setCloseError("Укажите причину закрытия");
      return;
    }
    setClosing(true);
    setCloseError("");
    try {
      const res = await fetch(`/api/permits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "early_closed", closeReason: closeReason.trim() }),
      });
      if (!res.ok) {
        setCloseError("Ошибка при закрытии наряда-допуска");
        return;
      }
      const updated = await fetch(`/api/permits/${id}`, { credentials: "include" });
      if (updated.ok) setPermit(await updated.json());
      setCloseDialogOpen(false);
      setCloseReason("");
    } catch {
      setCloseError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setClosing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!permit) {
    notFound();
    return null;
  }

  const DEPARTMENT_NAMES: Record<string, string> = {
    security: "Служба безопасности",
    hr: "Отдел кадров",
    safety: "Охрана труда",
    safety_training: "Вводный инструктаж",
    permit_bureau: "Бюро пропусков/СБ",
  };

  function getApprovalBadge(status: string) {
    switch (status) {
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

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center gap-4">
        <Link href="/permits" className="inline-flex items-center">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Назад к списку
          </Button>
        </Link>
        <div className="flex-1" />
        {(permit.status === "active" || permit.status === "approved") && (userRole === "admin" || userRole === "contractor_employee") && (
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setCloseDialogOpen(true)}
          >
            <Archive className="h-4 w-4" />
            Закрыть
          </Button>
        )}
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => window.open(`/permits/${permit.id}/print`, "_blank")}
        >
          <Printer className="h-4 w-4" />
          Печать
        </Button>
      </div>

      {/* Permit info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="font-mono text-lg">{permit.permitNumber}</span>
            <Badge variant={statusConfig[permit.status]?.variant ?? "secondary"}>
              {statusConfig[permit.status]?.label ?? permit.status}
            </Badge>
          </CardTitle>
          <CardDescription>Информация о наряде-допуске</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Категория</div>
              <div className="text-sm text-zinc-900">{categoryLabels[permit.category] ?? permit.category}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Подрядчик</div>
              <div className="text-sm text-zinc-900">{permit.contractor?.name ?? "—"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Участок</div>
              <div className="text-sm text-zinc-900">{permit.workSite}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Ответственный</div>
              <div className="text-sm text-zinc-900">{permit.responsiblePerson}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Дата открытия</div>
              <div className="text-sm text-zinc-900">{formatDate(permit.openDate)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Срок действия</div>
              <div className="text-sm text-zinc-900">{formatDate(permit.expiryDate)}</div>
            </div>
            {permit.closeReason && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-zinc-400 uppercase">Причина закрытия</div>
                <div className="text-sm text-zinc-900">{permit.closeReason}</div>
              </div>
            )}
            {permit.closedAt && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-zinc-400 uppercase">Закрыт</div>
                <div className="text-sm text-zinc-900">{formatDate(permit.closedAt)}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Approval pipeline */}
      {permit.approvals && permit.approvals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Согласования</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {permit.approvals.map((approval, index) => {
                const isLast = index === permit.approvals.length - 1;
                const connectorColor =
                  approval.status === "approved"
                    ? "bg-green-400"
                    : approval.status === "rejected"
                      ? "bg-red-400"
                      : "bg-zinc-300";

                return (
                  <div key={approval.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                          approval.status === "approved" && "border-green-500 bg-green-500 text-white",
                          approval.status === "rejected" && "border-red-500 bg-red-500 text-white",
                          approval.status === "pending" && "border-zinc-300 bg-zinc-100 text-zinc-400"
                        )}
                      >
                        {approval.status === "approved" && <CheckCircle2 className="h-5 w-5" />}
                        {approval.status === "rejected" && <XCircle className="h-5 w-5" />}
                        {approval.status === "pending" && <Clock className="h-4 w-4" />}
                      </div>
                      {!isLast && <div className={cn("w-0.5 flex-1 min-h-[32px]", connectorColor)} />}
                    </div>
                    <div className={cn("pb-8 flex-1", isLast && "pb-0")}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-zinc-900">
                            {DEPARTMENT_NAMES[approval.department] ?? approval.department}
                          </p>
                          {approval.comment && (
                            <p className="mt-0.5 text-sm text-zinc-500">{approval.comment}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-3 text-sm text-zinc-500">
                          <span>Срок: {formatDate(approval.deadline)}</span>
                          {getApprovalBadge(approval.status)}
                          {approval.status === "pending" && (
                            <div className="flex gap-1 ml-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2.5 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50"
                                onClick={() => {
                                  setDecisionApprovalId(approval.id);
                                  setDecisionAction("approved");
                                  setDecisionComment("");
                                  setDecisionError("");
                                }}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Согласовать
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2.5 text-xs gap-1 text-red-700 border-red-200 hover:bg-red-50"
                                onClick={() => {
                                  setDecisionApprovalId(approval.id);
                                  setDecisionAction("rejected");
                                  setDecisionComment("");
                                  setDecisionError("");
                                }}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Отклонить
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approval decision dialog */}
      <Dialog
        open={!!decisionApprovalId}
        onOpenChange={(open) => {
          if (!open) {
            setDecisionApprovalId(null);
            setDecisionAction(null);
            setDecisionComment("");
            setDecisionError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionAction === "approved" ? "Согласование" : "Отклонение"} наряда-допуска
            </DialogTitle>
            <DialogDescription>
              {decisionAction === "approved"
                ? "Подтвердите согласование наряда-допуска"
                : "Укажите причину отклонения (обязательно)"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {decisionAction === "rejected" && (
              <div className="space-y-1.5">
                <Label>Причина отклонения *</Label>
                <Textarea
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  placeholder="Причина отклонения..."
                  rows={3}
                />
              </div>
            )}
            {decisionAction === "approved" && (
              <div className="space-y-1.5">
                <Label>Комментарий (необязательно)</Label>
                <Textarea
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  placeholder="Комментарий к согласованию..."
                  rows={2}
                />
              </div>
            )}
            {decisionError && <p className="text-sm text-red-600">{decisionError}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDecisionApprovalId(null);
                setDecisionAction(null);
                setDecisionComment("");
                setDecisionError("");
              }}
              disabled={deciding}
            >
              Отмена
            </Button>
            <Button
              variant={decisionAction === "rejected" ? "destructive" : "default"}
              onClick={handleDecision}
              disabled={deciding}
            >
              {deciding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {decisionAction === "approved" ? "Согласовать" : "Отклонить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Досрочное закрытие наряда-допуска</DialogTitle>
            <DialogDescription>Укажите причину закрытия</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Причина</Label>
              <Textarea
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                placeholder="Причина закрытия..."
                rows={3}
              />
            </div>
            {closeError && <p className="text-sm text-red-600">{closeError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCloseDialogOpen(false); setCloseError(""); }} disabled={closing}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleClosePermit} disabled={closing}>
              {closing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
