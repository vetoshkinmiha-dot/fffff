"use client";

import { useState, useEffect, useCallback } from "react";
import { notFound } from "next/navigation";
import { Plus, Search, Eye, Loader2, Pencil, Key } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const roleLabels: Record<string, string> = {
  admin: "Администратор",
  employee: "Сотрудник",
  contractor_admin: "Ответственный подрядчика",
  contractor_employee: "Сотрудник подрядчика",
  department_approver: "Согласующий",
};

const departmentLabels: Record<string, string> = {
  security: "Служба безопасности",
  hr: "Отдел кадров",
  safety: "Охрана труда",
  safety_training: "Вводный инструктаж",
  permit_bureau: "Бюро пропусков/СБ",
};

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  organizationId: string | null;
  department: string | null;
  isActive: boolean;
  mustChangePwd: boolean;
  organization?: { name: string };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  // Create/edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "contractor_admin",
    organizationId: "",
    department: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState("");

  // Password reset dialog
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search ? { search } : {}),
        ...(roleFilter !== "all" ? { role: roleFilter } : {}),
        ...(orgFilter !== "all" ? { organizationId: orgFilter } : {}),
        ...(statusFilter !== "all" ? { isActive: statusFilter === "active" ? "true" : "false" } : {}),
      });
      const res = await fetch(`/api/users?${params}`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data ?? []);
        setTotal(json.pagination?.total ?? 0);
        setTotalPages(json.pagination?.pages ?? 1);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, orgFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetch("/api/organizations", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setOrganizations(data.data || []))
      .catch(() => {});
  }, []);

  function openCreateDialog() {
    setEditUser(null);
    setForm({ email: "", password: "", fullName: "", role: "contractor_employee", organizationId: "", department: "" });
    setFormErrors({});
    setDialogError("");
    setDialogOpen(true);
  }

  function openEditDialog(user: User) {
    setEditUser(user);
    setForm({
      email: user.email,
      password: "",
      fullName: user.fullName,
      role: user.role,
      organizationId: user.organizationId || "",
      department: user.department || "",
    });
    setFormErrors({});
    setDialogError("");
    setDialogOpen(true);
  }

  async function handleSubmit() {
    setDialogError("");
    setFormErrors({});

    if (!editUser && !form.email.trim()) {
      setFormErrors({ email: "Обязательное поле" });
      return;
    }
    if (!editUser && !form.password) {
      setFormErrors({ password: "Обязательное поле" });
      return;
    }
    if (!form.fullName.trim()) {
      setFormErrors({ fullName: "Обязательное поле" });
      return;
    }

    setSubmitting(true);
    try {
      const body: any = {
        fullName: form.fullName.trim(),
        role: form.role,
        organizationId: form.organizationId || null,
        department: form.department || null,
      };

      let res: Response;
      if (editUser) {
        res = await fetch(`/api/users/${editUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        body.email = form.email.trim();
        body.password = form.password;
        res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setDialogError(data.error || "Ошибка при сохранении");
        return;
      }

      setDialogOpen(false);
      fetchUsers();
    } catch {
      setDialogError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(user: User) {
    try {
      await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      fetchUsers();
    } catch {
      // ignore
    }
  }

  async function handleResetPassword() {
    if (!resetUser || !resetPassword) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/users/${resetUser.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: resetPassword }),
      });
      if (res.ok) {
        setResetUser(null);
        setResetPassword("");
      }
    } catch {
      // ignore
    } finally {
      setResetting(false);
    }
  }

  const filteredUsers = users; // API handles filtering

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Управление пользователями
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Администрирование пользователей системы
          </p>
        </div>
        <Button variant="default" size="lg" onClick={openCreateDialog}>
          <Plus />
          Добавить пользователя
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Поиск по email или ФИО..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v ?? "all"); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Все роли" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все роли</SelectItem>
            {Object.entries(roleLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? "all"); setPage(1); }} itemToStringLabel={(v) => ({ all: "Все статусы", active: "Активные", blocked: "Заблокированные" }[v] ?? v)}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue>{(v: string) => ({ all: "Все статусы", active: "Активные", blocked: "Заблокированные" }[v] ?? v ?? "Все статусы")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="active">Активные</SelectItem>
            <SelectItem value="blocked">Заблокированные</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border border-zinc-200 bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-medium">Email</TableHead>
              <TableHead className="font-medium">ФИО</TableHead>
              <TableHead className="font-medium">Роль</TableHead>
              <TableHead className="font-medium">Организация</TableHead>
              <TableHead className="font-medium">Статус</TableHead>
              <TableHead className="text-right font-medium">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-zinc-500">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-zinc-500">
                  Пользователи не найдены
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="text-zinc-600 font-mono text-xs">{user.email}</TableCell>
                  <TableCell className="font-medium text-zinc-900">{user.fullName}</TableCell>
                  <TableCell className="text-sm text-zinc-600">{roleLabels[user.role] ?? user.role}</TableCell>
                  <TableCell className="text-sm text-zinc-600">{user.organization?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "outline" : "destructive"}>
                      {user.isActive ? "Активен" : "Заблокирован"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Изменить
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(user)}
                        className={user.isActive ? "text-red-600" : "text-green-600"}
                      >
                        {user.isActive ? "Заблокировать" : "Активировать"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setResetUser(user); setResetPassword(""); }}
                      >
                        Сброс пароля
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards — users */}
      <div className="md:hidden space-y-3">
        {filteredUsers.map((user) => (
          <div key={user.id} className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-900">{user.fullName}</span>
              <Badge variant={user.isActive ? "outline" : "destructive"}>
                {user.isActive ? "Активен" : "Неактивен"}
              </Badge>
            </div>
            <div className="text-xs text-zinc-500">{user.email}</div>
            <div className="text-xs text-zinc-500">{roleLabels[user.role] ?? user.role}</div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDialog(user)}>
                <Pencil className="size-4 mr-1" />Изменить
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { setResetUser(user); setResetPassword(""); }}>
                <Key className="size-4 mr-1" />Сброс
              </Button>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-zinc-400">
            Показано {filteredUsers.length} из {total} пользователей
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Назад
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Вперёд
            </Button>
          </div>
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editUser ? "Редактирование пользователя" : "Создание пользователя"}</DialogTitle>
            <DialogDescription>
              {editUser ? "Измените данные пользователя" : "Заполните данные нового пользователя"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                disabled={!!editUser}
                className={formErrors.email ? "border-red-300" : ""}
              />
              {formErrors.email && <p className="text-xs text-red-600">{formErrors.email}</p>}
            </div>
            {!editUser && (
              <div className="space-y-1.5">
                <Label>Пароль *</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className={formErrors.password ? "border-red-300" : ""}
                />
                {formErrors.password && <p className="text-xs text-red-600">{formErrors.password}</p>}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>ФИО *</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                className={formErrors.fullName ? "border-red-300" : ""}
              />
              {formErrors.fullName && <p className="text-xs text-red-600">{formErrors.fullName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Роль</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v ?? "" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Организация</Label>
              <Select value={form.organizationId} onValueChange={(v) => setForm((f) => ({ ...f, organizationId: v ?? "" }))} itemToStringLabel={(v) => organizations.find((o) => o.id === v)?.name ?? ""}>
                <SelectTrigger><SelectValue placeholder="Без организации">{(v) => v ? organizations.find((o) => o.id === v)?.name ?? "" : "Без организации"}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Без организации</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Департамент</Label>
              <Select value={form.department} onValueChange={(v) => setForm((f) => ({ ...f, department: v ?? "" }))}>
                <SelectTrigger><SelectValue placeholder="Не указан" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Не указан</SelectItem>
                  {Object.entries(departmentLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {dialogError && <p className="text-sm text-red-600">{dialogError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editUser ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password reset dialog */}
      <Dialog open={!!resetUser} onOpenChange={(open) => { if (!open) { setResetUser(null); setResetPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сброс пароля</DialogTitle>
            <DialogDescription>
              Новый пароль для {resetUser?.fullName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Новый пароль</Label>
              <Input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Минимум 8 символов"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetUser(null); setResetPassword(""); }} disabled={resetting}>
              Отмена
            </Button>
            <Button onClick={handleResetPassword} disabled={resetting || !resetPassword}>
              {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сбросить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
