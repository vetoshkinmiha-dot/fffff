"use client";

import { useState, useEffect } from "react";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Download, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { variant: "outline" | "destructive" | "secondary"; label: string }> = {
  passed: { variant: "outline", label: "Пройден" },
  failed: { variant: "destructive", label: "Не пройден" },
  in_progress: { variant: "secondary", label: "В процессе" },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface ChecklistItem {
  id: string;
  question: string;
  answer: "pass" | "fail" | "n/a" | null;
  comment: string | null;
  photoUrl: string | null;
}

interface Checklist {
  id: string;
  date: string;
  inspectorName: string;
  comments: string | null;
  score: number | null;
  status: string;
  createdAt: string;
  contractor: { name: string; sequentialNumber: number };
  createdBy: { fullName: string } | null;
  items: ChecklistItem[];
}

function ScoreBar({ score, status }: { score: number | null; status: string }) {
  const pct = score ?? 0;
  const color = status === "passed" ? "#10b981" : status === "failed" ? "#ef4444" : "#f59e0b";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-500">Результат</span>
        <span className="font-semibold text-zinc-900">{pct}%</span>
      </div>
      <div className="h-3 rounded-full bg-zinc-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function AnswerBadge({ answer }: { answer: string | null }) {
  if (!answer) return <span className="text-zinc-400 text-sm">—</span>;
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pass: { bg: "bg-green-100", text: "text-green-800", label: "Pass" },
    fail: { bg: "bg-red-100", text: "text-red-800", label: "Fail" },
    "n/a": { bg: "bg-zinc-100", text: "text-zinc-600", label: "N/A" },
  };
  const c = config[answer] ?? config["n/a"];
  return (
    <Badge variant="outline" className={cn(c.bg, c.text)}>
      {c.label}
    </Badge>
  );
}

export default function ChecklistDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedItems, setEditedItems] = useState<ChecklistItem[]>([]);
  const [editingComment, setEditingComment] = useState<string | null>(null);

  useEffect(() => {
    async function fetchChecklist() {
      setLoading(true);
      try {
        const res = await fetch(`/api/checklists/${id}`, { credentials: "include" });
        if (res.status === 404) {
          setChecklist(null);
        } else if (res.ok) {
          setChecklist(await res.json());
        }
      } catch {
        setChecklist(null);
      } finally {
        setLoading(false);
      }
    }
    fetchChecklist();
  }, [id]);

  function startEditing() {
    setEditedItems(checklist?.items.map((item) => ({ ...item })) ?? []);
    setEditingComment(checklist?.comments ?? null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setEditedItems([]);
    setEditingComment(null);
  }

  async function saveEditing() {
    setSaving(true);
    try {
      const res = await fetch(`/api/checklists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          items: editedItems.map((item) => ({
            question: item.question,
            answer: item.answer,
            comment: item.comment || undefined,
            photoUrl: item.photoUrl || undefined,
          })),
        }),
      });
      if (!res.ok) {
        // Silently fail — editing mode stays active so user can retry
        return;
      }

      const updated = await fetch(`/api/checklists/${id}`, { credentials: "include" });
      if (updated.ok) setChecklist(await updated.json());
      setEditing(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  function updateEditedItem(index: number, field: keyof ChecklistItem, value: string | null) {
    setEditedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function handleDownloadStats() {
    if (!checklist) return;
    const passed = checklist.items.filter((i) => i.answer === "pass").length;
    const failed = checklist.items.filter((i) => i.answer === "fail").length;
    const na = checklist.items.filter((i) => i.answer === "n/a").length;
    const total = checklist.items.length;

    const csv = [
      "Чек-лист проверок",
      `Подрядчик,${checklist.contractor.name}`,
      `Дата,${formatDate(checklist.date)}`,
      `Инспектор,${checklist.inspectorName}`,
      `Статус,${statusConfig[checklist.status]?.label ?? checklist.status}`,
      `Результат,${checklist.score ?? 0}%`,
      "",
      "Пункты",
      "#,Вопрос,Результат,Комментарий",
      ...checklist.items.map(
        (item, i) =>
          `${i + 1},"${item.question}","${item.answer ?? "—"}","${item.comment ?? ""}"`
      ),
      "",
      "Итого",
      `Всего пунктов,${total}`,
      `Pass,${passed}`,
      `Fail,${failed}`,
      `N/A,${na}`,
    ].join("\n");

    const safeName = checklist.contractor.name.replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s-]/g, "").trim().replace(/\s+/g, "-");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `checklist-${safeName}-${checklist.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!checklist) {
    notFound();
    return null;
  }

  const passed = checklist.items.filter((i) => i.answer === "pass").length;
  const failed = checklist.items.filter((i) => i.answer === "fail").length;
  const na = checklist.items.filter((i) => i.answer === "n/a").length;
  const total = checklist.items.length;

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <Link href="/checklists">
          <Button variant="ghost" size="icon-xs">
            <ArrowLeft />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Чек-лист
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {checklist.contractor.name}
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleDownloadStats}
        >
          <Download className="h-4 w-4" />
          Статистика
        </Button>
        {!editing && (
          <Button
            variant="outline"
            className="gap-2"
            onClick={startEditing}
          >
            <Edit2 className="h-4 w-4" />
            Редактировать
          </Button>
        )}
        {editing && (
          <>
            <Button variant="ghost" onClick={cancelEditing} disabled={saving}>
              Отмена
            </Button>
            <Button className="gap-2" onClick={saveEditing} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <Check className="h-4 w-4" />
              Сохранить
            </Button>
          </>
        )}
        <Badge variant={statusConfig[checklist.status]?.variant ?? "secondary"}>
          {statusConfig[checklist.status]?.label ?? checklist.status}
        </Badge>
      </div>

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Информация</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Дата</div>
              <div className="text-sm text-zinc-900">{formatDate(checklist.date)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Инспектор</div>
              <div className="text-sm text-zinc-900">{checklist.inspectorName}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Создал</div>
              <div className="text-sm text-zinc-900">{checklist.createdBy?.fullName ?? "—"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Создан</div>
              <div className="text-sm text-zinc-900">{formatDate(checklist.createdAt)}</div>
            </div>
          </div>
          {checklist.comments && (
            <div className="mt-4 space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase">Комментарий</div>
              <div className="text-sm text-zinc-900 whitespace-pre-wrap">{checklist.comments}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Score */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Результат проверки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScoreBar score={checklist.score} status={checklist.status} />
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-green-500" />
              <span className="text-zinc-600">Pass: <span className="font-medium text-zinc-900">{passed}</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-red-500" />
              <span className="text-zinc-600">Fail: <span className="font-medium text-zinc-900">{failed}</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-zinc-400" />
              <span className="text-zinc-600">N/A: <span className="font-medium text-zinc-900">{na}</span></span>
            </div>
            <div className="text-zinc-400">Всего: {total}</div>
          </div>
        </CardContent>
      </Card>

      {/* Items table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Пункты проверки</CardTitle>
          <CardDescription>
            {editing ? "Редактирование результатов" : `${checklist.items.length} пунктов`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Вопрос</TableHead>
                  <TableHead className="w-28">Результат</TableHead>
                  <TableHead>Комментарий</TableHead>
                  <TableHead className="w-20">Фото</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(editing ? editedItems : checklist.items).map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-zinc-400 text-xs font-mono">
                      {index + 1}
                    </TableCell>
                    <TableCell className="font-medium text-zinc-900 max-w-xs">
                      {item.question}
                    </TableCell>
                    <TableCell>
                      {editing ? (
                        <Select
                          value={item.answer ?? ""}
                          onValueChange={(v) =>
                            updateEditedItem(index, "answer", v as ChecklistItem["answer"])
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pass">Pass</SelectItem>
                            <SelectItem value="fail">Fail</SelectItem>
                            <SelectItem value="n/a">N/A</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <AnswerBadge answer={item.answer} />
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600 max-w-xs">
                      {editing ? (
                        <Input
                          value={item.comment ?? ""}
                          onChange={(e) => updateEditedItem(index, "comment", e.target.value)}
                          placeholder="Примечание"
                          className="text-sm"
                        />
                      ) : (
                        item.comment ?? "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {item.photoUrl ? (
                        <a
                          href={item.photoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Фото
                        </a>
                      ) : (
                        <span className="text-zinc-400 text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3 p-4">
            {(editing ? editedItems : checklist.items).map((item, index) => (
              <div
                key={item.id}
                className="rounded-lg border border-zinc-200 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-400">#{index + 1}</span>
                  {!editing && <AnswerBadge answer={item.answer} />}
                </div>
                <div className="text-sm font-medium text-zinc-900">{item.question}</div>
                {editing && (
                  <Select
                    value={item.answer ?? ""}
                    onValueChange={(v) =>
                      updateEditedItem(index, "answer", v as ChecklistItem["answer"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pass">Pass</SelectItem>
                      <SelectItem value="fail">Fail</SelectItem>
                      <SelectItem value="n/a">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {editing ? (
                  <Input
                    value={item.comment ?? ""}
                    onChange={(e) => updateEditedItem(index, "comment", e.target.value)}
                    placeholder="Комментарий"
                  />
                ) : item.comment ? (
                  <div className="text-sm text-zinc-500">{item.comment}</div>
                ) : null}
                {item.photoUrl && (
                  <a
                    href={item.photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Фото
                  </a>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
