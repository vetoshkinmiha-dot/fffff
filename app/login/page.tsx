"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ContractorAccount {
  fullName: string;
  email: string;
  temporaryPassword: string | null;
  organizationId: string | null;
  createdAt: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<ContractorAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  useEffect(() => {
    // Fetch contractor_employee accounts for display
    setAccountsLoading(true);
    fetch("/api/auth/accounts", { credentials: "include" })
      .then((r) => {
        if (r.ok) return r.json();
        return null;
      })
      .then((data) => {
        if (data?.data) setAccounts(data.data);
      })
      .catch(() => {})
      .finally(() => setAccountsLoading(false));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка авторизации");
        return;
      }

      const roleRedirects: Record<string, string> = {
        admin: "/",
        employee: "/contractors",
        contractor_admin: "/my-organization",
        contractor_employee: "/my-organization",
        department_approver: "/",
      };
      const redirectTo = roleRedirects[data.user?.role] ?? "/contractors";
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  function setCredentials(email: string) {
    setEmail(email);
    setPassword("password");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        {/* Logo / Title */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900">
            ЗАО «ВШЗ»
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Система управления подрядными организациями
          </p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5"
        >
          <h2 className="text-lg font-semibold text-zinc-900">Вход в систему</h2>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@company.ru"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Вход..." : "Войти"}
          </Button>
        </form>

        {/* Demo Credentials */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
          <p className="text-sm font-medium text-zinc-700">Демо-учётные записи (пароль везде: <code className="bg-zinc-100 px-1 rounded">password</code>):</p>
          <div className="space-y-2 text-xs">
            {/* Admin */}
            <div
              className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 cursor-pointer hover:bg-zinc-100 transition-colors"
              onClick={() => setCredentials("admin@vshz.ru")}
            >
              <div>
                <span className="font-medium text-zinc-800">Администратор</span>
                <span className="text-zinc-500 ml-1">(полный доступ)</span>
              </div>
              <code className="text-zinc-500">admin@vshz.ru</code>
            </div>

            {/* Approvers */}
            <div className="border-t border-zinc-200 pt-2 mt-1">
              <span className="font-medium text-zinc-700">Согласующие</span>
            </div>
            <div
              className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 cursor-pointer hover:bg-zinc-100 transition-colors"
              onClick={() => setCredentials("dp.security@vshz.ru")}
            >
              <div>
                <span className="font-medium text-zinc-800">Иванов А.С.</span>
                <span className="text-zinc-500 ml-1">(СБ)</span>
              </div>
              <code className="text-zinc-500">dp.security@vshz.ru</code>
            </div>
            <div
              className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 cursor-pointer hover:bg-zinc-100 transition-colors"
              onClick={() => setCredentials("dp.hr@vshz.ru")}
            >
              <div>
                <span className="font-medium text-zinc-800">Петрова Е.В.</span>
                <span className="text-zinc-500 ml-1">(HR)</span>
              </div>
              <code className="text-zinc-500">dp.hr@vshz.ru</code>
            </div>
            <div
              className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 cursor-pointer hover:bg-zinc-100 transition-colors"
              onClick={() => setCredentials("dp.safety@vshz.ru")}
            >
              <div>
                <span className="font-medium text-zinc-800">Сидоров К.Н.</span>
                <span className="text-zinc-500 ml-1">(ОТ)</span>
              </div>
              <code className="text-zinc-500">dp.safety@vshz.ru</code>
            </div>
            <div
              className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 cursor-pointer hover:bg-zinc-100 transition-colors"
              onClick={() => setCredentials("dp.safety.tr@vshz.ru")}
            >
              <div>
                <span className="font-medium text-zinc-800">Козлова М.Р.</span>
                <span className="text-zinc-500 ml-1">(Инструктаж)</span>
              </div>
              <code className="text-zinc-500">dp.safety.tr@vshz.ru</code>
            </div>
            <div
              className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 cursor-pointer hover:bg-zinc-100 transition-colors"
              onClick={() => setCredentials("dp.permit@vshz.ru")}
            >
              <div>
                <span className="font-medium text-zinc-800">Новиков Д.А.</span>
                <span className="text-zinc-500 ml-1">(Пропуска)</span>
              </div>
              <code className="text-zinc-500">dp.permit@vshz.ru</code>
            </div>

            {/* Employee */}
            <div
              className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 cursor-pointer hover:bg-zinc-100 transition-colors"
              onClick={() => setCredentials("employee@vshz.ru")}
            >
              <div>
                <span className="font-medium text-zinc-800">Сотрудник завода</span>
                <span className="text-zinc-500 ml-1">(только просмотр)</span>
              </div>
              <code className="text-zinc-500">employee@vshz.ru</code>
            </div>

            {/* Contractor Org 1 */}
            <div className="border-t border-zinc-200 pt-2 mt-1">
              <span className="font-medium text-zinc-700">ООО «СтройМонтаж»</span>
            </div>
            <div
              className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 cursor-pointer hover:bg-amber-100 transition-colors"
              onClick={() => setCredentials("morozov@stroymontazh.ru")}
            >
              <div>
                <span className="font-medium text-amber-900">Морозов И.С.</span>
                <span className="text-amber-600 ml-1 text-[10px] font-semibold">ОТВЕТСТВЕННЫЙ</span>
              </div>
              <code className="text-amber-700">morozov@stroymontazh.ru</code>
            </div>
            <div
              className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 cursor-pointer hover:bg-zinc-50 transition-colors"
              onClick={() => setCredentials("smirnov@stroymontazh.ru")}
            >
              <div>
                <span className="text-zinc-800">Смирнов А.В. — сварщик</span>
              </div>
              <code className="text-zinc-500">smirnov@stroymontazh.ru</code>
            </div>
            <div
              className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 cursor-pointer hover:bg-zinc-50 transition-colors"
              onClick={() => setCredentials("kuznetsova@stroymontazh.ru")}
            >
              <div>
                <span className="text-zinc-800">Кузнецова М.И. — электрик</span>
              </div>
              <code className="text-zinc-500">kuznetsova@stroymontazh.ru</code>
            </div>
            <div
              className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 cursor-pointer hover:bg-zinc-50 transition-colors"
              onClick={() => setCredentials("popov@stroymontazh.ru")}
            >
              <div>
                <span className="text-zinc-800">Попов Д.С. — монтажник</span>
              </div>
              <code className="text-zinc-500">popov@stroymontazh.ru</code>
            </div>

            {/* Contractor Org 2 */}
            <div className="border-t border-zinc-200 pt-2 mt-1">
              <span className="font-medium text-zinc-700">АО «ЭнергоСервис»</span>
            </div>
            <div
              className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 cursor-pointer hover:bg-amber-100 transition-colors"
              onClick={() => setCredentials("volkov@energoservis.ru")}
            >
              <div>
                <span className="font-medium text-amber-900">Волков А.Н.</span>
                <span className="text-amber-600 ml-1 text-[10px] font-semibold">ОТВЕТСТВЕННЫЙ</span>
              </div>
              <code className="text-amber-700">volkov@energoservis.ru</code>
            </div>
            <div
              className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 cursor-pointer hover:bg-zinc-50 transition-colors"
              onClick={() => setCredentials("lebedeva@energoservis.ru")}
            >
              <div>
                <span className="text-zinc-800">Лебедева Е.Д. — слесарь</span>
              </div>
              <code className="text-zinc-500">lebedeva@energoservis.ru</code>
            </div>
            <div
              className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 cursor-pointer hover:bg-zinc-50 transition-colors"
              onClick={() => setCredentials("novikov.s@energoservis.ru")}
            >
              <div>
                <span className="text-zinc-800">Новиков С.П. — каменщик</span>
              </div>
              <code className="text-zinc-500">novikov.s@energoservis.ru</code>
            </div>
            <div
              className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 cursor-pointer hover:bg-zinc-50 transition-colors"
              onClick={() => setCredentials("fedorov@energoservis.ru")}
            >
              <div>
                <span className="text-zinc-800">Федоров Н.А. — плотник</span>
              </div>
              <code className="text-zinc-500">fedorov@energoservis.ru</code>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-zinc-400">
          Нажмите на учётную запись чтобы автоматически подставить email и пароль
        </p>

        {/* Auto-created contractor_employee accounts */}
        {accounts.length > 0 && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-3">
            <p className="text-sm font-medium text-blue-800">Учётные записи сотрудников подрядчиков</p>
            <div className="space-y-2 text-xs">
              {accounts.map((acc, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-white px-3 py-2 border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={() => {
                    if (acc.email) {
                      setEmail(acc.email);
                      setPassword(acc.temporaryPassword ?? "");
                    }
                  }}
                >
                  <div className="font-medium text-zinc-800">{acc.fullName}</div>
                  <div className="flex gap-4 mt-1 text-zinc-600">
                    <span>Логин: <code className="bg-zinc-100 px-1 rounded">{acc.email}</code></span>
                    {acc.temporaryPassword && (
                      <span>Пароль: <code className="bg-zinc-100 px-1 rounded">{acc.temporaryPassword}</code></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!accountsLoading && accounts.length === 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 text-center text-sm text-zinc-500">
            Нет учётных записей сотрудников подрядчиков
          </div>
        )}
        {accountsLoading && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 text-center text-sm text-zinc-500">
            Загрузка учётных записей...
          </div>
        )}
      </div>
    </div>
  );
}
