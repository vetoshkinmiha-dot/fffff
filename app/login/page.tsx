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
}

const DEMO_ACCOUNTS: {
  group: string;
  items: { label: string; sub?: string; email: string; password: string; highlight?: boolean }[];
}[] = [
  {
    group: "Администратор",
    items: [
      { label: "Администратор", sub: "полный доступ", email: "admin@pirelli.ru", password: "Admin123!" },
    ],
  },
  {
    group: "Сотрудник завода",
    items: [
      { label: "Просматривающий", sub: "только просмотр", email: "employee@pirelli.ru", password: "Employee1!" },
    ],
  },
  {
    group: "Согласующие департаментов",
    items: [
      { label: "Иванов А.С.", sub: "Служба безопасности", email: "security@pirelli.ru", password: "Approver1!" },
      { label: "Петрова Е.В.", sub: "Отдел кадров", email: "hr@pirelli.ru", password: "Approver1!" },
      { label: "Сидоров К.Н.", sub: "Охрана труда (допуск)", email: "safety@pirelli.ru", password: "Approver1!" },
      { label: "Козлова М.Р.", sub: "Охрана труда (инструктаж)", email: "safetytraining@pirelli.ru", password: "Approver1!" },
      { label: "Новиков Д.А.", sub: "Бюро пропусков", email: "permitbureau@pirelli.ru", password: "Approver1!" },
    ],
  },
  {
    group: 'ООО «СтройЭнергоМонтаж»',
    items: [
      { label: "Ответственный", sub: "contractor_admin", email: "resp_1@stroymont.ru", password: "Org1Admin1!", highlight: true },
      { label: "Сидоров П.И.", sub: "contractor_employee", email: "podradchik@pirelli.ru", password: "Contractor1!" },
    ],
  },
  {
    group: 'АО «ТрансТехСервис»',
    items: [
      { label: "Ответственный", sub: "contractor_admin", email: "resp_2@stroymont.ru", password: "Org2Admin1!", highlight: true },
    ],
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<ContractorAccount[]>([]);

  useEffect(() => {
    fetch("/api/auth/accounts", { credentials: "include" })
      .then((r) => {
        if (r.ok) return r.json();
        return null;
      })
      .then((data) => {
        if (data?.data) setAccounts(data.data);
      })
      .catch(() => {});
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
      // Full page reload to ensure new cookies are applied
      window.location.href = redirectTo;
    } catch {
      setError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  function setCredentials(email: string, pwd: string) {
    setEmail(email);
    setPassword(pwd);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-8">
      <div className="w-full max-w-md space-y-6">
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

        {/* Demo Credentials — from seed data */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
          <p className="text-sm font-medium text-zinc-700">Демо-учётные записи</p>
          <div className="space-y-2 text-xs">
            {DEMO_ACCOUNTS.map((group) => (
              <div key={group.group}>
                <div className="border-t border-zinc-200 pt-2 mt-2 first:mt-0 first:border-0 first:pt-0">
                  <span className="font-medium text-zinc-700">{group.group}</span>
                </div>
                {group.items.map((item) => (
                  <div
                    key={item.email}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer hover:opacity-80 transition-opacity mt-1 ${
                      item.highlight ? "bg-amber-50" : "bg-zinc-50"
                    }`}
                    onClick={() => setCredentials(item.email, item.password)}
                  >
                    <div>
                      <span className={`font-medium ${item.highlight ? "text-amber-900" : "text-zinc-800"}`}>
                        {item.label}
                      </span>
                      {item.sub && (
                        <span className={`ml-1 text-[10px] font-semibold ${item.highlight ? "text-amber-600" : "text-zinc-500"}`}>
                          ({item.sub})
                        </span>
                      )}
                    </div>
                    <code className={`${item.highlight ? "text-amber-700" : "text-zinc-500"}`}>{item.email}</code>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Auto-created contractor_employee accounts (from add-employee) */}
        {accounts.length > 0 && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-3">
            <p className="text-sm font-medium text-blue-800">Автоматически созданные учётные записи</p>
            <div className="space-y-2 text-xs">
              {accounts.map((acc, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-white px-3 py-2 border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.temporaryPassword ?? "");
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

        <p className="text-center text-[10px] text-zinc-400">
          Нажмите на учётную запись чтобы автоматически подставить email и пароль
        </p>
      </div>
    </div>
  );
}
