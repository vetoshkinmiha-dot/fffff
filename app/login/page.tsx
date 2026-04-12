"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

      router.push("/");
      router.refresh();
    } catch {
      setError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
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
          <p className="text-sm font-medium text-zinc-700">Демо-учётные записи:</p>
          <div className="space-y-2 text-xs">
            <div
              className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 cursor-pointer hover:bg-zinc-100 transition-colors"
              onClick={() => { setEmail("admin@pirelli.ru"); setPassword("Admin123!"); }}
            >
              <div>
                <span className="font-medium text-zinc-800">Администратор</span>
                <span className="text-zinc-500 ml-1">(все функции)</span>
              </div>
              <code className="text-zinc-500">admin@pirelli.ru</code>
            </div>
            <div
              className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 cursor-pointer hover:bg-zinc-100 transition-colors"
              onClick={() => { setEmail("approver@pirelli.ru"); setPassword("Approver1!"); }}
            >
              <div>
                <span className="font-medium text-zinc-800">Согласующий</span>
                <span className="text-zinc-500 ml-1">(ОТ — safety)</span>
              </div>
              <code className="text-zinc-500">approver@pirelli.ru</code>
            </div>
            <div
              className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 cursor-pointer hover:bg-zinc-100 transition-colors"
              onClick={() => { setEmail("podradchik@pirelli.ru"); setPassword("Contractor1!"); }}
            >
              <div>
                <span className="font-medium text-zinc-800">Подрядчик</span>
                <span className="text-zinc-500 ml-1">(свои данные)</span>
              </div>
              <code className="text-zinc-500">podradchik@pirelli.ru</code>
            </div>
            <div
              className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 cursor-pointer hover:bg-zinc-100 transition-colors"
              onClick={() => { setEmail("employee@pirelli.ru"); setPassword("Employee1!"); }}
            >
              <div>
                <span className="font-medium text-zinc-800">Сотрудник</span>
                <span className="text-zinc-500 ml-1">(только просмотр)</span>
              </div>
              <code className="text-zinc-500">employee@pirelli.ru</code>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-zinc-400">
          Нажмите на учётную запись чтобы автоматически подставить email и пароль
        </p>
      </div>
    </div>
  );
}
