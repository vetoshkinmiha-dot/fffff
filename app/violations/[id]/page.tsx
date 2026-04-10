"use client";

import { useState, useEffect } from "react";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, ArrowUp, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const severityConfig: Record<string, { variant: "default" | "destructive" | "secondary" | "outline"; label: string; color: string }> = {
  low: { variant: "outline", label: "Низкий", color: "text-green-600" },
  medium: { variant: "secondary", label: "Средний", color: "text-yellow-600" },
  high: { variant: "default", label: "Высокий", color: "text-orange-600" },
  critical: { variant: "destructive", label: "Критический", color: "text-red-600" },
};

const statusLabels: Record<string, string> = {
  pending: "Ожидает",
  resolved: "Устранено",
  escalated: "Эскалировано",
};

const departmentLabels: Record<string, string> = {
  hse: "ОТ и ПБ (HSE)",
  curator: "Куратор договора",
  procurement: "Закупки",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface Violation {
  id: string;
  date: string;
  description: string;
  severity: string;
  status: string;
  department: string | null;
  contractor: { name: string; sequentialNumber: number };
  reportedBy: string;
  photos: string[];
  resolutionNotes: string | null;
  resolvedAt: string | null;
}

export default function ViolationDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [violation, setViolation] = useState<Violation | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolvingStatus, setResolvingStatus] = useState<"resolved" | "escalated">("resolved");

  // Complaint state
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [complaintText, setComplaintText] = useState("");
  const [complaintDept, setComplaintDept] = useState("curator");
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [complaintError, setComplaintError] = useState("");

  useEffect(() => {
    async function fetchViolation() {
      setLoading(true);
      try {
        const res = await fetch(`/api/violations/${id}`, { credentials: "include" });
        if (res.status === 404) {
          notFound();
        } else if (res.ok) {
          setViolation(await res.json());
        }
      } catch {
        notFound();
      } finally {
        setLoading(false);
      }
    }
    fetchViolation();
  }, [id]);

  async function handleResolve() {
    if (!resolutionNotes.trim()) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/violations/${id}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: resolvingStatus, notes: resolutionNotes.trim() }),
      });
      if (res.ok) {
        const updated = await fetch(`/api/violations/${id}`, { credentials: "include" });
        if (updated.ok) setViolation(await updated.json());
      }
    } catch {
      // ignore
    } finally {
      setResolving(false);
    }
  }

  async function handleComplaint() {
    if (!complaintText.trim()) {
      setComplaintError("Напишите текст жалобы");
      return;
    }
    setSubmittingComplaint(true);
    setComplaintError("");
    try {
      const res = await fetch(`/api/violations/${id}/complaints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: complaintText.trim(), department: complaintDept }),
      });
      if (res.ok) {
        setComplaintOpen(false);
        setComplaintText("");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!violation) {
    notFound();
    return null;
  }

  const sev = severityConfig[violation.severity] ?? severityConfig.medium;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/violations">
          <Button variant="ghost" size="icon-xs">
            <ArrowLeft />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Акт нарушения
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Детальная информация о нарушении
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => window.open(`/violations/${violation.id}/print`, "_blank")}
        >
          <Printer className="h-4 w-4" />
          Печать
        </Button>
        <Badge variant={sev.variant} className={sev.color}>
          {sev.label}
        </Badge>
        <Badge variant="outline">
          {statusLabels[violation.status] ?? violation.status}
        </Badge>
      </div>

      {/* Violation info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Информация</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Дата</div>
              <div className="text-sm text-zinc-900">{formatDate(violation.date)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Подрядчик</div>
              <div className="text-sm text-zinc-900">{violation.contractor?.name ?? "—"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Департамент</div>
              <div className="text-sm text-zinc-900">{departmentLabels[violation.department] ?? "—"}</div>
            </div>
            <div className="sm:col-span-3 space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Описание</div>
              <div className="text-sm text-zinc-900 whitespace-pre-wrap">{violation.description}</div>
            </div>
            {violation.photos && violation.photos.length > 0 && (
              <div className="sm:col-span-3 space-y-1">
                <div className="text-xs font-medium text-zinc-400 uppercase">Фото</div>
                <div className="flex gap-2 flex-wrap mt-2">
                  {violation.photos.map((photo, i) => (
                    <img key={i} src={photo} alt={`Фото ${i + 1}`} className="h-32 w-32 rounded-lg object-cover" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resolution section */}
      {violation.status === "pending" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Решение</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Статус</Label>
              <Select value={resolvingStatus} onValueChange={(v) => setResolvingStatus(v as "resolved" | "escalated")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resolved">Устранено</SelectItem>
                  <SelectItem value="escalated">Эскалировано</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Примечания</Label>
              <Textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Описание решения..."
                rows={3}
              />
            </div>
            <Button onClick={handleResolve} disabled={resolving || !resolutionNotes.trim()} className="gap-2">
              {resolving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : resolvingStatus === "resolved" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
              {resolvingStatus === "resolved" ? "Отметить как устранено" : "Эскалировать"}
            </Button>
          </CardContent>
        </Card>
      )}

      {violation.resolvedAt && violation.resolutionNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Решение</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Статус</div>
              <div className="text-sm text-zinc-900">{statusLabels[violation.status]}</div>
            </div>
            <div className="mt-3 space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Примечания</div>
              <div className="text-sm text-zinc-900 whitespace-pre-wrap">{violation.resolutionNotes}</div>
            </div>
            <div className="mt-2 text-xs text-zinc-400">
              Обновлено: {formatDate(violation.resolvedAt)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complaint section (for contractor users) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Жалоба подрядчика</CardTitle>
          <CardDescription>
            Если вы не согласны с актом нарушения, подайте жалобу
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!complaintOpen ? (
            <Button variant="outline" onClick={() => setComplaintOpen(true)}>
              Отправить жалобу
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Департамент</Label>
                <Select value={complaintDept} onValueChange={(v) => setComplaintDept(v ?? "")}>
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
                  rows={3}
                />
              </div>
              {complaintError && (
                <p className="text-sm text-red-600">{complaintError}</p>
              )}
              <div className="flex gap-2">
                <Button onClick={handleComplaint} disabled={submittingComplaint}>
                  {submittingComplaint && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Отправить жалобу
                </Button>
                <Button variant="ghost" onClick={() => { setComplaintOpen(false); setComplaintError(""); }}>
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
