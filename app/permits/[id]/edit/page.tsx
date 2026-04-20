"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

interface Organization {
  id: string;
  name: string;
}

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "hot_work", label: "Огневые работы" },
  { value: "height_work", label: "Работы на высоте" },
  { value: "confined_space", label: "Замкнутые пространства" },
  { value: "electrical", label: "Электробезопасность" },
  { value: "excavation", label: "Земляные работы" },
  { value: "other", label: "Прочее" },
];

function dateToInput(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toISOString().split("T")[0];
}

export default function EditPermitPage() {
  const router = useRouter();
  const params = useParams();
  const permitId = params.id as string;

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [form, setForm] = useState({
    contractorId: "",
    category: "",
    workSite: "",
    responsiblePerson: "",
    openDate: "",
    expiryDate: "",
  });

  // Fetch auth + organizations + existing permit data
  useEffect(() => {
    async function init() {
      try {
        const [authRes, orgsRes, permitRes] = await Promise.all([
          fetch("/api/auth/me", { credentials: "include" }),
          fetch("/api/organizations", { credentials: "include" }),
          fetch(`/api/permits/${permitId}`, { credentials: "include" }),
        ]);

        const role = authRes.ok ? (await authRes.json()).user?.role : null;
        if (role === "admin" || role === "contractor_admin" || role === "contractor_employee") {
          setAuthorized(true);
        } else {
          setAuthorized(false);
        }

        if (orgsRes.ok) {
          const data = await orgsRes.json();
          setOrganizations(data.data || []);
        }

        if (permitRes.ok) {
          const permit = await permitRes.json();
          setForm({
            contractorId: permit.contractorId || "",
            category: permit.category || "",
            workSite: permit.workSite || "",
            responsiblePerson: permit.responsiblePerson || "",
            openDate: dateToInput(permit.openDate),
            expiryDate: dateToInput(permit.expiryDate),
          });
        }
      } catch {
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [permitId]);

  if (authorized === null || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!authorized) {
    router.push(`/permits/${permitId}`);
    return null;
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.contractorId) errs.contractorId = "Выберите подрядчика";
    if (!form.category) errs.category = "Выберите категорию";
    if (!form.workSite.trim()) errs.workSite = "Обязательное поле";
    if (!form.responsiblePerson.trim()) errs.responsiblePerson = "Обязательное поле";
    if (!form.openDate) errs.openDate = "Обязательное поле";
    if (!form.expiryDate) errs.expiryDate = "Обязательное поле";
    if (form.openDate && form.expiryDate && form.expiryDate <= form.openDate)
      errs.expiryDate = "Срок должен быть позже даты открытия";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/permits/${permitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          openDate: new Date(form.openDate).toISOString(),
          expiryDate: new Date(form.expiryDate).toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка при обновлении наряда-допуска");
        return;
      }

      router.push(`/permits/${permitId}`);
    } catch {
      setError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/permits/${permitId}`}>
          <Button variant="ghost" size="icon-xs">
            <ArrowLeft />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Редактирование наряда-допуска
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Изменение данных наряда-допуска
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
            <Label>Категория работ *</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((prev) => ({ ...prev, category: v ?? "" }))}
            >
              <SelectTrigger className={fieldErrors.category ? "border-red-300" : ""}>
                <SelectValue placeholder="Выберите категорию" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.category && (
              <p className="text-xs text-red-600">{fieldErrors.category}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Подрядчик *</Label>
            <Select
              value={form.contractorId}
              onValueChange={(v) => setForm((prev) => ({ ...prev, contractorId: v ?? "" }))}
              itemToStringLabel={(v) => organizations.find((o) => o.id === v)?.name ?? v}
            >
              <SelectTrigger className={fieldErrors.contractorId ? "border-red-300" : ""}>
                <SelectValue placeholder="Выберите подрядчика">{(v) => organizations.find((o) => o.id === v)?.name ?? v ?? "Выберите подрядчика"}</SelectValue>
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
        </div>

        <div className="space-y-1.5">
          <Label>Участок работ *</Label>
          <Textarea
            value={form.workSite}
            onChange={(e) => setForm((prev) => ({ ...prev, workSite: e.target.value }))}
            placeholder="г. Москва, ул. ..., д. ..."
            rows={2}
            className={fieldErrors.workSite ? "border-red-300" : ""}
          />
          {fieldErrors.workSite && (
            <p className="text-xs text-red-600">{fieldErrors.workSite}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Ответственный *</Label>
          <Input
            value={form.responsiblePerson}
            onChange={(e) => setForm((prev) => ({ ...prev, responsiblePerson: e.target.value }))}
            placeholder="Иванов И.И."
            className={fieldErrors.responsiblePerson ? "border-red-300" : ""}
          />
          {fieldErrors.responsiblePerson && (
            <p className="text-xs text-red-600">{fieldErrors.responsiblePerson}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Дата открытия *</Label>
            <Input
              type="date"
              value={form.openDate}
              onChange={(e) => setForm((prev) => ({ ...prev, openDate: e.target.value }))}
              className={fieldErrors.openDate ? "border-red-300" : ""}
            />
            {fieldErrors.openDate && (
              <p className="text-xs text-red-600">{fieldErrors.openDate}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Срок действия *</Label>
            <Input
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
              className={fieldErrors.expiryDate ? "border-red-300" : ""}
            />
            {fieldErrors.expiryDate && (
              <p className="text-xs text-red-600">{fieldErrors.expiryDate}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={`/permits/${permitId}`}>
            <Button variant="outline" type="button">Отмена</Button>
          </Link>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Сохранить
          </Button>
        </div>
      </form>
    </div>
  );
}
