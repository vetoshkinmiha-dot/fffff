"use client";

import { Suspense, useState, FormEvent, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface Organization {
  id: string;
  name: string;
}

const SEVERITY_OPTIONS = [
  { value: "low", label: "Низкий" },
  { value: "medium", label: "Средний" },
  { value: "high", label: "Высокий" },
  { value: "critical", label: "Критический" },
];

const DEPARTMENT_OPTIONS = [
  { value: "hse", label: "ОТ и ПБ (HSE)" },
  { value: "curator", label: "Куратор договора" },
  { value: "procurement", label: "Закупки" },
];

function NewViolationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("templateId");

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    contractorId: "",
    description: "",
    severity: "medium",
    department: "hse",
    violationDate: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/organizations", { credentials: "include" }).then((r) => r.json()),
      templateId
        ? fetch(`/api/violations/templates/${templateId}`, { credentials: "include" }).then((r) => r.ok ? r.json() : null)
        : Promise.resolve(null),
    ]).then(([orgData, tmplData]) => {
      setOrganizations(orgData.data || []);
      if (tmplData) {
        setForm((prev) => ({
          ...prev,
          description: tmplData.description || "",
          severity: tmplData.defaultSeverity || "medium",
          department: tmplData.department || "hse",
        }));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [templateId]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.contractorId) errs.contractorId = "Выберите подрядчика";
    if (!form.description.trim()) errs.description = "Опишите нарушение";
    if (!form.violationDate) errs.violationDate = "Укажите дату";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/violations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractorId: form.contractorId,
          description: form.description.trim(),
          severity: form.severity,
          department: form.department,
          date: new Date(form.violationDate).toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка при создании акта нарушения");
        return;
      }

      router.push(`/violations/${data.id}`);
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
      <div className="flex items-center gap-3">
        <Link href="/violations">
          <Button variant="ghost" size="icon-xs">
            <ArrowLeft />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Новый акт нарушения
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Регистрация нарушения подрядной организации
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
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.contractorId && (
              <p className="text-xs text-red-600">{fieldErrors.contractorId}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Дата нарушения *</Label>
            <Input
              type="date"
              value={form.violationDate}
              onChange={(e) => setForm((prev) => ({ ...prev, violationDate: e.target.value }))}
              className={fieldErrors.violationDate ? "border-red-300" : ""}
            />
            {fieldErrors.violationDate && (
              <p className="text-xs text-red-600">{fieldErrors.violationDate}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Описание нарушения *</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Подробное описание нарушения..."
            rows={4}
            className={fieldErrors.description ? "border-red-300" : ""}
          />
          {fieldErrors.description && (
            <p className="text-xs text-red-600">{fieldErrors.description}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Тяжесть</Label>
            <Select
              value={form.severity}
              onValueChange={(v) => setForm((prev) => ({ ...prev, severity: v ?? "" }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Департамент</Label>
            <Select
              value={form.department}
              onValueChange={(v) => setForm((prev) => ({ ...prev, department: v ?? "" }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/violations">
            <Button variant="outline" type="button">Отмена</Button>
          </Link>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Создать акт
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function NewViolationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      }
    >
      <NewViolationForm />
    </Suspense>
  );
}
