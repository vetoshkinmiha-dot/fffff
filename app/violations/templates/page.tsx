"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Eye, Loader2, AlertCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const severityLabels: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  critical: "Критический",
};

const severityColors: Record<string, string> = {
  low: "text-green-600",
  medium: "text-yellow-600",
  high: "text-orange-600",
  critical: "text-red-600",
};

const departmentLabels: Record<string, string> = {
  hse: "ОТ и ПБ (HSE)",
  curator: "Куратор договора",
  procurement: "Закупки",
};

interface Template {
  id: string;
  title: string;
  description: string;
  defaultSeverity: string;
  department: string;
  isActive: boolean;
  createdBy: { fullName: string } | null;
  createdAt: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ViolationTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [filterActive, setFilterActive] = useState("all");
  const [isHSE, setIsHSE] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    defaultSeverity: "medium",
    department: "hse",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me", { credentials: "include" }),
      fetch("/api/violations/templates", { credentials: "include" }),
    ]).then(async ([userRes, tmplRes]) => {
      if (userRes.ok) {
        const userData = await userRes.json();
        const isAdmin = userData.user?.role === "admin";
        setIsHSE(isAdmin);
        if (!isAdmin) {
          router.push("/violations");
          return;
        }
      }
      if (tmplRes.ok) {
        const data = await tmplRes.json();
        setTemplates(data.data || []);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = templates.filter((t) => {
    if (filterDept !== "all" && t.department !== filterDept) return false;
    if (filterActive === "active" && !t.isActive) return false;
    if (filterActive === "inactive" && t.isActive) return false;
    return true;
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.title.trim() || !form.description.trim()) {
      setError("Заполните все обязательные поля");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/violations/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          defaultSeverity: form.defaultSeverity,
          department: form.department,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ошибка при создании шаблона");
        return;
      }
      // Refresh templates
      const refetch = await fetch("/api/violations/templates", { credentials: "include" });
      if (refetch.ok) {
        const data = await refetch.json();
        setTemplates(data.data || []);
      }
      setCreateOpen(false);
      setForm({ title: "", description: "", defaultSeverity: "medium", department: "hse" });
    } catch {
      setError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/violations">
            <Button variant="ghost" size="icon-xs">
              <ArrowLeft />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Шаблоны актов нарушений
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Повторно используемые шаблоны для быстрого оформления
            </p>
          </div>
        </div>
        {isHSE && (
          <Button variant="default" size="lg" onClick={() => setCreateOpen(true)}>
            <Plus />
            Создать шаблон
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterDept} onValueChange={(v) => setFilterDept(v ?? "all")}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Все департаменты" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все департаменты</SelectItem>
            <SelectItem value="hse">ОТ и ПБ (HSE)</SelectItem>
            <SelectItem value="curator">Куратор договора</SelectItem>
            <SelectItem value="procurement">Закупки</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterActive} onValueChange={(v) => setFilterActive(v ?? "all")}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Все" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все</SelectItem>
            <SelectItem value="active">Активные</SelectItem>
            <SelectItem value="inactive">Неактивные</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-medium">Название</TableHead>
              <TableHead className="font-medium">Департамент</TableHead>
              <TableHead className="font-medium">Тяжесть</TableHead>
              <TableHead className="font-medium">Статус</TableHead>
              <TableHead className="font-medium">Автор</TableHead>
              <TableHead className="font-medium">Дата</TableHead>
              <TableHead className="text-right font-medium">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-zinc-500">
                  Шаблоны не найдены
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium text-zinc-900 max-w-xs truncate">
                    {t.title}
                  </TableCell>
                  <TableCell className="text-sm text-zinc-600">
                    {departmentLabels[t.department] ?? t.department}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={severityColors[t.defaultSeverity]}>
                      {severityLabels[t.defaultSeverity] ?? t.defaultSeverity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.isActive ? "outline" : "secondary"}>
                      {t.isActive ? "Активен" : "Неактивен"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-500">
                    {t.createdBy?.fullName ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-zinc-500 font-mono text-xs">
                    {formatDate(t.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/violations/new?templateId=${t.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        Применить
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create template dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать шаблон акта нарушения</DialogTitle>
            <DialogDescription>
              Заполните информацию для повторно используемого шаблона
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Название *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Шаблон нарушения"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Описание *</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Описание типового нарушения"
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Тяжесть</Label>
                <Select
                  value={form.defaultSeverity}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, defaultSeverity: v ?? "medium" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(severityLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Департамент</Label>
                <Select
                  value={form.department}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, department: v ?? "hse" }))}
                >
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
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => { setCreateOpen(false); setError(""); }}>
                Отмена
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Создать
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
