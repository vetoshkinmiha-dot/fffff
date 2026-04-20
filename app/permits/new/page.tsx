"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
  contactPersonName: string | null;
}

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "hot_work", label: "Огневые работы" },
  { value: "height_work", label: "Работы на высоте" },
  { value: "confined_space", label: "Замкнутые пространства" },
  { value: "electrical", label: "Электробезопасность" },
  { value: "excavation", label: "Земляные работы" },
  { value: "other", label: "Прочее" },
];

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export default function NewPermitPage() {
  const router = useRouter();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const orgIdRef = useRef<string>("");

  const [form, setForm] = useState({
    contractorId: "",
    category: "",
    workSite: "",
    responsiblePerson: "",
    openDate: todayStr(),
    expiryDate: "",
  });

  const isContractor = userRole === "contractor_admin" || userRole === "contractor_employee";

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const role = data?.user?.role;
        if (role === "admin" || role === "contractor_admin" || role === "department_approver") {
          setAuthorized(true);
          setUserRole(role);
          orgIdRef.current = data?.user?.organizationId ?? "";
        } else {
          setAuthorized(false);
        }
      })
      .catch(() => setAuthorized(false));

    fetch("/api/organizations", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const orgs = data.data || [];
        setOrganizations(orgs);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Auto-fill contractor and responsible person (from org's contactPersonName)
  useEffect(() => {
    if (orgIdRef.current && organizations.length > 0) {
      const ownOrg = organizations.find((o) => o.id === orgIdRef.current);
      if (ownOrg) {
        setForm((prev) => ({
          ...prev,
          contractorId: ownOrg.id,
          responsiblePerson: ownOrg.contactPersonName || "",
        }));
      }
    }
  }, [organizations.length]);

  // Update responsible when contractor selection changes (for admin)
  useEffect(() => {
    if (!form.contractorId) return;
    const org = organizations.find((o) => o.id === form.contractorId);
    if (org) {
      setForm((prev) => ({ ...prev, responsiblePerson: org.contactPersonName || "" }));
    }
  }, [form.contractorId]);

  if (authorized === null || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!authorized) {
    router.push("/permits");
    return null;
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.contractorId) errs.contractorId = "Выберите подрядчика";
    if (!form.category) errs.category = "Выберите категорию";
    if (!form.workSite.trim()) errs.workSite = "Обязательное поле";
    if (!form.responsiblePerson) errs.responsiblePerson = "Выберите ответственного";
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
      const res = await fetch("/api/permits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          responsiblePerson: form.responsiblePerson,
          openDate: new Date(form.openDate + "T00:00:00").toISOString(),
          expiryDate: new Date(form.expiryDate + "T00:00:00").toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка при создании наряда-допуска");
        return;
      }

      router.push(`/permits/${data.id}`);
    } catch {
      setError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/permits">
          <Button variant="ghost" size="icon-xs">
            <ArrowLeft />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Новый наряд-допуск
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Регистрация наряда-допуска на проведение работ
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
            {isContractor ? (
              <Input
                value={organizations.find((o) => o.id === form.contractorId)?.name ?? ""}
                disabled
                className="bg-zinc-50"
              />
            ) : (
              <>
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
              </>
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
            disabled
            className="bg-zinc-50"
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
          <Link href="/permits">
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
