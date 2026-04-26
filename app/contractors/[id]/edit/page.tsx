"use client";

import { useState, useEffect, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function EditContractorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: "",
    inn: "",
    kpp: "",
    legalAddress: "",
    contactPersonName: "",
    contactPhone: "",
    contactEmail: "",
  });

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.role === "admin") {
          setAuthorized(true);
        } else {
          setAuthorized(false);
        }
      })
      .catch(() => setAuthorized(false));

    async function loadContractor() {
      try {
        const res = await fetch(`/api/organizations/${id}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setForm({
            name: data.name || "",
            inn: data.inn || "",
            kpp: data.kpp || "",
            legalAddress: data.legalAddress || "",
            contactPersonName: data.contactPersonName || "",
            contactPhone: data.contactPhone || "",
            contactEmail: data.contactEmail || "",
          });
        } else if (res.status === 401) {
          window.location.href = "/login";
        }
      } catch {
        setError("Не удалось загрузить данные подрядчика");
      } finally {
        setFetching(false);
      }
    }
    loadContractor();
  }, [id]);

  if (authorized === null || fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!authorized) {
    router.push("/contractors");
    return null;
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Обязательное поле";
    if (!/^\d{10}$|^\d{12}$/.test(form.inn))
      errs.inn = "ИНН должен содержать 10 или 12 цифр";
    if (form.kpp && !/^\d{9}$/.test(form.kpp))
      errs.kpp = "КПП должен содержать 9 цифр";
    if (!form.legalAddress.trim()) errs.legalAddress = "Обязательное поле";
    if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail))
      errs.contactEmail = "Некорректный email";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/organizations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          inn: form.inn,
          kpp: form.kpp,
          legalAddress: form.legalAddress,
          contactPersonName: form.contactPersonName || null,
          contactPhone: form.contactPhone || null,
          contactEmail: form.contactEmail || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error?.includes("ИНН")) {
          setFieldErrors({ inn: "Подрядчик с таким ИНН уже существует" });
        } else {
          setError(data.error || "Ошибка при обновлении подрядчика");
        }
        return;
      }

      router.push(`/contractors`);
    } catch {
      setError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link href={`/contractors`}>
          <Button variant="ghost" size="icon-xs">
            <ArrowLeft />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Редактирование подрядчика
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Изменение данных подрядной организации
          </p>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5 transition-shadow duration-200 hover:shadow-md"
      >
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Legal name */}
        <div className="space-y-1.5">
          <Label htmlFor="name">Наименование организации *</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="ООО «Название»"
            className={fieldErrors.name ? "border-red-300" : ""}
          />
          {fieldErrors.name && (
            <p className="text-xs text-red-600">{fieldErrors.name}</p>
          )}
        </div>

        {/* INN + KPP row */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="inn">ИНН *</Label>
            <Input
              id="inn"
              value={form.inn}
              onChange={(e) => handleChange("inn", e.target.value.replace(/\D/g, "").slice(0, 12))}
              placeholder="10 или 12 цифр"
              maxLength={12}
              className={fieldErrors.inn ? "border-red-300" : ""}
            />
            {fieldErrors.inn && (
              <p className="text-xs text-red-600">{fieldErrors.inn}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kpp">КПП</Label>
            <Input
              id="kpp"
              value={form.kpp}
              onChange={(e) => handleChange("kpp", e.target.value.replace(/\D/g, "").slice(0, 9))}
              placeholder="9 цифр"
              maxLength={9}
              className={fieldErrors.kpp ? "border-red-300" : ""}
            />
            {fieldErrors.kpp && (
              <p className="text-xs text-red-600">{fieldErrors.kpp}</p>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="space-y-1.5">
          <Label htmlFor="legalAddress">Юридический адрес *</Label>
          <Textarea
            id="legalAddress"
            value={form.legalAddress}
            onChange={(e) => handleChange("legalAddress", e.target.value)}
            placeholder="г. Москва, ул. ..., д. ..."
            rows={2}
            className={fieldErrors.legalAddress ? "border-red-300" : ""}
          />
          {fieldErrors.legalAddress && (
            <p className="text-xs text-red-600">{fieldErrors.legalAddress}</p>
          )}
        </div>

        {/* Contact info */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="contactPersonName">Контактное лицо</Label>
            <Input
              id="contactPersonName"
              value={form.contactPersonName}
              onChange={(e) => handleChange("contactPersonName", e.target.value)}
              placeholder="Иванов И.И."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactPhone">Телефон</Label>
            <Input
              id="contactPhone"
              type="tel"
              value={form.contactPhone}
              onChange={(e) => handleChange("contactPhone", e.target.value)}
              placeholder="+7 (999) 123-45-67"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactEmail">Email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={form.contactEmail}
              onChange={(e) => handleChange("contactEmail", e.target.value)}
              placeholder="info@company.ru"
              className={fieldErrors.contactEmail ? "border-red-300" : ""}
            />
            {fieldErrors.contactEmail && (
              <p className="text-xs text-red-600">{fieldErrors.contactEmail}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={`/contractors`}>
            <Button variant="outline" type="button">Отмена</Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Сохранить
          </Button>
        </div>
      </form>
    </div>
  );
}
