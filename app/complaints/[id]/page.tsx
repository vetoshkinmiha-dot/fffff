"use client";

import { useState, useEffect } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const complaintStatusLabels: Record<string, string> = {
  pending: "Ожидает",
  resolved: "Рассмотрено",
  rejected: "Отклонено",
};

const complaintStatusConfig: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  resolved: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
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

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
  resolvedAt: string | null;
}

export default function ComplaintDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [authorized, setAuthorized] = useState(false);
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.role) {
          setUserRole(data.user.role);
          if (data.user.role === "admin" || data.user.role === "contractor_admin" || data.user.role === "contractor_employee") {
            setAuthorized(true);
          } else {
            router.push("/violations");
          }
        }
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
    async function fetchComplaint() {
      setLoading(true);
      try {
        const res = await fetch(`/api/complaints/${id}`, { credentials: "include" });
        if (res.status === 404) {
          notFound();
        } else if (res.status === 403) {
          router.push("/complaints");
        } else if (res.ok) {
          setComplaint(await res.json());
        }
      } catch {
        notFound();
      } finally {
        setLoading(false);
      }
    }
    fetchComplaint();
  }, [id, authorized, router]);

  async function handleResolve(status: "resolved" | "rejected") {
    if (!complaint || !resolveNotes.trim()) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/complaints/${complaint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolutionNotes: resolveNotes.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setComplaint(updated);
      }
    } catch {
      // ignore
    } finally {
      setResolving(false);
    }
  }

  if (!authorized || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!complaint) {
    notFound();
    return null;
  }

  const cfg = complaintStatusConfig[complaint.status] ?? complaintStatusConfig.pending;
  const isAdmin = userRole === "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/complaints">
          <Button variant="ghost" size="icon-xs">
            <ArrowLeft />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Жалоба
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {complaint.contractor?.name ?? "—"} · {departmentLabels[complaint.department] ?? complaint.department}
          </p>
        </div>
        <Badge variant="outline" className={cfg}>
          {complaintStatusLabels[complaint.status] ?? complaint.status}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Информация</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Подрядчик</div>
              <div className="text-sm text-zinc-900">{complaint.contractor?.name ?? "—"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Департамент</div>
              <div className="text-sm text-zinc-900">{departmentLabels[complaint.department] ?? complaint.department}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Кто подал</div>
              <div className="text-sm text-zinc-900">{complaint.createdBy?.fullName ?? "—"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Дата подачи</div>
              <div className="text-sm text-zinc-900">{formatDate(complaint.createdAt)}</div>
            </div>
            {complaint.violation && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-zinc-400 uppercase">Связанный акт</div>
                <div className="text-sm">
                  <Link href={`/violations/${complaint.violation.id}`} className="font-mono text-zinc-900 underline">
                    {complaint.violation.violationNumber}
                  </Link>
                </div>
              </div>
            )}
            <div className="sm:col-span-2 space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Текст жалобы</div>
              <div className="text-sm text-zinc-900 whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-3">
                {complaint.complaintText}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {complaint.status !== "pending" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Резолюция</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Статус</div>
              <Badge variant="outline" className={cfg}>
                {complaintStatusLabels[complaint.status]}
              </Badge>
            </div>
            {complaint.resolutionNotes && (
              <div className="mt-3 space-y-1">
                <div className="text-xs font-medium text-zinc-400 uppercase">Примечания</div>
                <div className="text-sm text-zinc-900 whitespace-pre-wrap">{complaint.resolutionNotes}</div>
              </div>
            )}
            {complaint.resolvedAt && (
              <div className="mt-2 text-xs text-zinc-400">
                Дата: {formatDate(complaint.resolvedAt)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {complaint.status === "pending" && isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Рассмотреть жалобу</CardTitle>
            <CardDescription>
              Укажите примечания и выберите результат рассмотрения
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Примечания</Label>
              <Textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                placeholder="Примечания по рассмотрению..."
                rows={3}
              />
            </div>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
