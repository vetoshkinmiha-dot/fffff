"use client";

import { Suspense, useState, FormEvent, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, Plus, X } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";

function NewEmployeeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedContractorId = searchParams.get("contractorId");

  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    contractorId: preselectedContractorId ?? "",
    fullName: "",
    position: "",
    passportSeries: "",
    passportNumber: "",
    passportIssuedBy: "",
    passportIssueDate: "",
    previouslyAtPirelli: false,
    workClasses: [] as string[],
  });
  const [newWorkClass, setNewWorkClass] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

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
    if (!form.fullName.trim()) errs.fullName = "Обязательное поле";
    if (!form.position.trim()) errs.position = "Обязательное поле";
    if (!/^\d{4}$/.test(form.passportSeries))
      errs.passportSeries = "Серия — 4 цифры";
    if (!/^\d{6}$/.test(form.passportNumber))
      errs.passportNumber = "Номер — 6 цифр";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: form.contractorId,
          fullName: form.fullName,
          position: form.position,
          passportSeries: form.passportSeries,
          passportNumber: form.passportNumber,
          passportIssuedBy: form.passportIssuedBy.trim() || undefined,
          passportIssueDate: form.passportIssueDate ? new Date(form.passportIssueDate).toISOString() : undefined,
          previouslyAtPirelli: form.previouslyAtPirelli,
          workClasses: form.workClasses,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка при создании сотрудника");
        return;
      }

      // Upload photo if selected (Task 2.2)
      if (photoFile) {
        try {
          const photoFormData = new FormData();
          photoFormData.append("file", photoFile);
          await fetch(`/api/employees/${data.id}/photo`, {
            method: "POST",
            body: photoFormData,
          });
        } catch {
          // Photo upload is non-critical, don't fail the whole flow
        }
      }

      router.push(`/employees/${data.id}`);
    } catch {
      setError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  function addWorkClass() {
    const cls = newWorkClass.trim();
    if (cls && !form.workClasses.includes(cls)) {
      setForm((prev) => ({ ...prev, workClasses: [...prev.workClasses, cls] }));
      setNewWorkClass("");
    }
  }

  function removeWorkClass(cls: string) {
    setForm((prev) => ({
      ...prev,
      workClasses: prev.workClasses.filter((c) => c !== cls),
    }));
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
      <div className="flex items-center gap-3">
        <Link href="/employees">
          <Button variant="ghost" size="icon-xs">
            <ArrowLeft />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Новый сотрудник
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Добавление работника подрядной организации
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5"
      >
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="contractorId">Подрядчик *</Label>
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">ФИО *</Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, fullName: e.target.value }))
              }
              placeholder="Иванов Иван Иванович"
              className={fieldErrors.fullName ? "border-red-300" : ""}
            />
            {fieldErrors.fullName && (
              <p className="text-xs text-red-600">{fieldErrors.fullName}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="position">Должность *</Label>
            <Input
              id="position"
              value={form.position}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, position: e.target.value }))
              }
              placeholder="Электромонтажник"
              className={fieldErrors.position ? "border-red-300" : ""}
            />
            {fieldErrors.position && (
              <p className="text-xs text-red-600">{fieldErrors.position}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Паспортные данные</Label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Input
                value={form.passportSeries}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    passportSeries: e.target.value.replace(/\D/g, "").slice(0, 4),
                  }))
                }
                placeholder="Серия (4 цифры)"
                maxLength={4}
                className={fieldErrors.passportSeries ? "border-red-300" : ""}
              />
              {fieldErrors.passportSeries && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.passportSeries}</p>
              )}
            </div>
            <div>
              <Input
                value={form.passportNumber}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    passportNumber: e.target.value.replace(/\D/g, "").slice(0, 6),
                  }))
                }
                placeholder="Номер (6 цифр)"
                maxLength={6}
                className={fieldErrors.passportNumber ? "border-red-300" : ""}
              />
              {fieldErrors.passportNumber && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.passportNumber}</p>
              )}
            </div>
            <div>
              <Input
                value={form.passportIssuedBy}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, passportIssuedBy: e.target.value }))
                }
                placeholder="Кем выдан"
              />
            </div>
            <div>
              <Input
                value={form.passportIssueDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, passportIssueDate: e.target.value }))
                }
                type="date"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Checkbox
              id="previouslyAtPirelli"
              checked={form.previouslyAtPirelli}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, previouslyAtPirelli: !!checked }))
              }
            />
            <Label htmlFor="previouslyAtPirelli" className="text-sm cursor-pointer">
              Ранее работал в Pirelli
            </Label>
          </div>
        </div>

        {/* Photo upload (Task 2.2) */}
        <div className="space-y-1.5">
          <Label>Фото</Label>
          <div className="flex items-center gap-4">
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 text-xs">
                Нет фото
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Input
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPhotoFile(file);
                    setPhotoPreview(URL.createObjectURL(file));
                  }
                }}
              />
              {photoFile && (
                <button
                  type="button"
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                  className="text-xs text-zinc-500 hover:text-red-600 underline"
                >
                  Удалить фото
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Классы работ</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {form.workClasses.map((cls) => (
              <Badge
                key={cls}
                variant="outline"
                className="flex items-center gap-1 px-2 py-1"
              >
                {cls}
                <button
                  type="button"
                  onClick={() => removeWorkClass(cls)}
                  className="ml-1 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newWorkClass}
              onChange={(e) => setNewWorkClass(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addWorkClass();
                }
              }}
              placeholder="Введите класс работ и нажмите Enter"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addWorkClass}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/employees">
            <Button variant="outline" type="button">Отмена</Button>
          </Link>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Создать
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function NewEmployeePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      }
    >
      <NewEmployeeForm />
    </Suspense>
  );
}
