"use client";

import { useState, useEffect } from "react";
import { Loader2, Building2, MapPin, Mail, Phone, Hash, Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const statusLabels: Record<string, string> = {
  active: "Активен",
  pending: "Ожидает",
  blocked: "Заблокирован",
};

interface Organization {
  id: string;
  name: string;
  inn: string;
  kpp: string | null;
  legalAddress: string | null;
  contactPersonName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: string;
  sequentialNumber: number;
  _count?: { employees: number };
}

export default function MyOrganizationPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [error, setError] = useState("");
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const userRes = await fetch("/api/auth/me", { credentials: "include" });
        if (!userRes.ok) { setLoading(false); return; }
        const userData = await userRes.json();
        if (cancelled) return;

        setCanEdit(userData?.user?.role === "contractor_admin" || userData?.user?.role === "admin");

        const myOrgId = userData?.user?.organizationId;
        if (!myOrgId) { setLoading(false); return; }

        const orgRes = await fetch(`/api/organizations/${myOrgId}`, { credentials: "include" });
        if (cancelled) return;
        if (orgRes.ok) {
          const data = await orgRes.json();
          setOrg(data);
          setContactEmail(data.contactEmail || "");
          setContactPhone(data.contactPhone || "");
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  async function handleSave() {
    if (!org) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ошибка при сохранении");
        return;
      }
      const updated = await res.json();
      setOrg(updated);
      setEditing(false);
    } catch {
      setError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-zinc-500">Организация не найдена</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Моя организация
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Информация о вашей подрядной организации
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          {canEdit && (editing ? (
            <>
              <Button variant="ghost" onClick={() => { setEditing(false); setError(""); }}>
                <X className="h-4 w-4 mr-1" />
                Отмена
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Сохранить
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" />
              Редактировать контакты
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="transition-shadow duration-200 hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-5 text-zinc-400" />
            Информация о компании
          </CardTitle>
          <CardDescription>
            Основные реквизиты и контактные данные
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Статус
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`size-2 rounded-full ${org.status === "active" ? "bg-emerald-500" : org.status === "pending" ? "bg-amber-500" : "bg-red-500"}`}
                />
                <Badge variant="outline">
                  {statusLabels[org.status] ?? org.status}
                </Badge>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Название
              </div>
              <div className="text-sm text-zinc-900">{org.name}</div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                ИНН
              </div>
              <div className="flex items-center gap-2 text-sm font-mono text-zinc-900">
                <Hash className="size-3.5 text-zinc-400" />
                {org.inn}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                КПП
              </div>
              <div className="text-sm text-zinc-900">{org.kpp || "—"}</div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Адрес
              </div>
              <div className="flex items-start gap-2 text-sm text-zinc-700">
                <MapPin className="size-3.5 text-zinc-400 mt-0.5 shrink-0" />
                {org.legalAddress || "—"}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Контактное лицо
              </div>
              <div className="text-sm text-zinc-700">{org.contactPersonName || "—"}</div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Email
              </div>
              {editing ? (
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              ) : (
                <div className="flex items-center gap-2 text-sm text-zinc-700">
                  <Mail className="size-3.5 text-zinc-400" />
                  {org.contactEmail || "—"}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Телефон
              </div>
              {editing ? (
                <Input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              ) : (
                <div className="flex items-center gap-2 text-sm text-zinc-700">
                  <Phone className="size-3.5 text-zinc-400" />
                  {org.contactPhone || "—"}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Сотрудников
              </div>
              <div className="text-sm text-zinc-900">
                {org._count?.employees ?? 0}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
