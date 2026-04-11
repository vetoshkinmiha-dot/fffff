"use client";

import { Suspense, useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, Plus, X, Upload } from "lucide-react";
import type { Contractor } from "@/app/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

interface ChecklistItemForm {
  question: string;
  answer: "pass" | "fail" | "n/a" | "";
  comment: string;
  photoFile: File | null;
}

function NewChecklistForm() {
  const router = useRouter();

  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    contractorId: "",
    inspectorName: "",
    date: "",
    comments: "",
  });

  const [items, setItems] = useState<ChecklistItemForm[]>([
    { question: "", answer: "", comment: "", photoFile: null },
  ]);

  useEffect(() => {
    fetch("/api/organizations", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setContractors(data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.contractorId) errs.contractorId = "Выберите подрядчика";
    if (!form.inspectorName.trim()) errs.inspectorName = "Обязательное поле";
    if (!form.date) errs.date = "Обязательное поле";

    const itemErrors: string[] = [];
    items.forEach((item, i) => {
      if (!item.question.trim()) itemErrors.push(`Пункт ${i + 1}: укажите вопрос`);
      if (!item.answer) itemErrors.push(`Пункт ${i + 1}: укажите результат`);
    });
    if (itemErrors.length > 0) errs.items = itemErrors.join(". ");

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      // Upload photos first
      const itemsWithPhotos = await Promise.all(
        items.map(async (item) => {
          let photoUrl: string | undefined;
          if (item.photoFile) {
            try {
              const formData = new FormData();
              formData.append("file", item.photoFile);
              const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
              });
              if (res.ok) {
                const data = await res.json();
                photoUrl = data.url;
              }
            } catch {
              // Photo upload is non-critical, continue without it
            }
          }
          return {
            question: item.question.trim(),
            answer: item.answer as "pass" | "fail" | "n/a",
            comment: item.comment.trim() || undefined,
            photoUrl,
          };
        })
      );

      const res = await fetch("/api/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          contractorId: form.contractorId,
          inspectorName: form.inspectorName.trim(),
          date: new Date(form.date).toISOString(),
          comments: form.comments.trim() || undefined,
          items: itemsWithPhotos,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка при создании чек-листа");
        return;
      }

      router.push(`/checklists/${data.id}`);
    } catch {
      setError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { question: "", answer: "", comment: "", photoFile: null },
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof ChecklistItemForm, value: string | File | null) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  const answeredCount = items.filter((i) => i.answer !== "").length;
  const passCount = items.filter((i) => i.answer === "pass").length;
  const failCount = items.filter((i) => i.answer === "fail").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/checklists">
          <Button variant="ghost" size="icon-xs" type="button">
            <ArrowLeft />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Новый чек-лист
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Создание чек-листа проверки подрядной организации
          </p>
        </div>
      </div>

      {/* Errors */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        </div>
      )}
      {fieldErrors.items && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {fieldErrors.items}
          </div>
        </div>
      )}

      {/* Score preview */}
      {answeredCount > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-zinc-500">Текущий результат</span>
                <span className="font-medium text-zinc-900">
                  {Math.round((passCount / answeredCount) * 100)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(passCount / answeredCount) * 100}%`,
                    backgroundColor: failCount > 0 ? "#ef4444" : "#10b981",
                  }}
                />
              </div>
            </div>
            <div className="flex gap-3 text-sm">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Pass: {passCount}
              </Badge>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                Fail: {failCount}
              </Badge>
              <span className="text-zinc-400">
                {answeredCount}/{items.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Form fields */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Подрядчик *</Label>
            <Select
              value={form.contractorId}
              onValueChange={(v) => setForm((prev) => ({ ...prev, contractorId: v ?? "" }))}
            >
              <SelectTrigger className={fieldErrors.contractorId ? "border-red-300" : ""}>
                <SelectValue placeholder="Выберите подрядчика" />
              </SelectTrigger>
              <SelectContent>
                {contractors.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.contractorId && (
              <p className="text-xs text-red-600">{fieldErrors.contractorId}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Инспектор *</Label>
            <Input
              value={form.inspectorName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, inspectorName: e.target.value }))
              }
              placeholder="ФИО инспектора"
              className={fieldErrors.inspectorName ? "border-red-300" : ""}
            />
            {fieldErrors.inspectorName && (
              <p className="text-xs text-red-600">{fieldErrors.inspectorName}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Дата проверки *</Label>
          <Input
            type="date"
            value={form.date}
            onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
            className={`sm:max-w-xs ${fieldErrors.date ? "border-red-300" : ""}`}
          />
          {fieldErrors.date && (
            <p className="text-xs text-red-600">{fieldErrors.date}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Комментарий</Label>
          <Textarea
            value={form.comments}
            onChange={(e) => setForm((prev) => ({ ...prev, comments: e.target.value }))}
            placeholder="Общие замечания по проверке..."
            rows={2}
          />
        </div>
      </div>

      {/* Checklist items */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-zinc-900">
            Пункты проверки
          </h2>
          <Button variant="outline" size="sm" className="gap-1" type="button" onClick={addItem}>
            <Plus className="h-4 w-4" />
            Добавить пункт
          </Button>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Вопрос *</TableHead>
                <TableHead className="w-36">Результат *</TableHead>
                <TableHead>Комментарий</TableHead>
                <TableHead className="w-32">Фото</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="text-zinc-400 text-xs font-mono">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.question}
                      onChange={(e) => updateItem(index, "question", e.target.value)}
                      placeholder="Описание пункта проверки"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={item.answer}
                      onValueChange={(v) => updateItem(index, "answer", v)}
                    >
                      <SelectTrigger
                        className={
                          item.answer === "pass"
                            ? "border-green-300 bg-green-50"
                            : item.answer === "fail"
                              ? "border-red-300 bg-red-50"
                              : ""
                        }
                      >
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pass">Pass</SelectItem>
                        <SelectItem value="fail">Fail</SelectItem>
                        <SelectItem value="n/a">N/A</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.comment}
                      onChange={(e) => updateItem(index, "comment", e.target.value)}
                      placeholder="Примечание"
                      className="text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    {item.photoFile ? (
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs max-w-[80px] truncate">
                          {item.photoFile.name}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => updateItem(index, "photoFile", null)}
                          className="text-zinc-400 hover:text-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <Input
                          type="file"
                          accept="image/jpeg,image/png"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) updateItem(index, "photoFile", file);
                          }}
                        />
                        <div className="flex items-center gap-1 text-zinc-400 hover:text-zinc-600 text-xs">
                          <Upload className="h-3.5 w-3.5" />
                          <span>Фото</span>
                        </div>
                      </label>
                    )}
                  </TableCell>
                  <TableCell>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-zinc-400 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile items */}
        <div className="md:hidden space-y-4">
          {items.map((item, index) => (
            <div
              key={index}
              className="rounded-lg border border-zinc-200 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-zinc-400">#{index + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-zinc-400 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Input
                value={item.question}
                onChange={(e) => updateItem(index, "question", e.target.value)}
                placeholder="Вопрос"
              />
              <Select
                value={item.answer}
                onValueChange={(v) => updateItem(index, "answer", v)}
              >
                <SelectTrigger
                  className={
                    item.answer === "pass"
                      ? "border-green-300 bg-green-50"
                      : item.answer === "fail"
                        ? "border-red-300 bg-red-50"
                        : ""
                  }
                >
                  <SelectValue placeholder="Результат" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pass">Pass</SelectItem>
                  <SelectItem value="fail">Fail</SelectItem>
                  <SelectItem value="n/a">N/A</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={item.comment}
                onChange={(e) => updateItem(index, "comment", e.target.value)}
                placeholder="Комментарий"
              />
              {item.photoFile ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs truncate">
                    {item.photoFile.name}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => updateItem(index, "photoFile", null)}
                    className="text-zinc-400 hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) updateItem(index, "photoFile", file);
                    }}
                  />
                  <div className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 cursor-pointer">
                    <Upload className="h-4 w-4" />
                    Прикрепить фото
                  </div>
                </label>
              )}
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full md:hidden"
          type="button"
          onClick={addItem}
        >
          <Plus className="h-4 w-4" />
          Добавить пункт
        </Button>
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <Link href="/checklists">
          <Button variant="outline" type="button">Отмена</Button>
        </Link>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Создать чек-лист
        </Button>
      </div>
    </form>
  );
}

export default function NewChecklistPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      }
    >
      <NewChecklistForm />
    </Suspense>
  );
}
