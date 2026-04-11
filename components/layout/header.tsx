"use client";

import { useEffect, useState } from "react";
import { Bell, LogOut, Search } from "lucide-react";
import { sanitize } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
}

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => {
        if (r.ok) return r.json();
        return null;
      })
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});

    fetch("/api/notifications/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data: Notification[]) => {
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.read).length);
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/login";
  }

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
    : "?";

  const roleLabels: Record<string, string> = {
    admin: "Администратор",
    factory_hse: "ОТ и ПБ",
    factory_hr: "Отдел кадров",
    factory_curator: "Куратор",
    contractor_admin: "Админ подрядчика",
    contractor_user: "Сотрудник подрядчика",
    security: "Служба безопасности",
    permit_bureau: "Бюро пропусков",
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-zinc-200 bg-white px-6">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Поиск…"
          className="w-full rounded-md border border-zinc-200 bg-zinc-50 pl-10 pr-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <button className="relative inline-flex items-center justify-center h-9 w-9 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <div className="px-3 py-2 border-b border-zinc-100">
              <p className="text-sm font-medium">Уведомления</p>
            </div>
            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-zinc-400">
                Нет уведомлений
              </div>
            ) : (
              notifications.map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  className={`cursor-pointer ${!n.read ? "bg-blue-50/50" : ""}`}
                  onClick={() => { if (n.link) window.location.href = n.link; }}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{n.title}</span>
                    <span className="text-xs text-zinc-500 truncate">{n.message}</span>
                  </div>
                  {!n.read && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                  )}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <div className="flex items-center gap-3 pl-4 border-l border-zinc-200 hover:opacity-80 transition-opacity cursor-pointer">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                {initials}
              </div>
              <div className="text-sm text-left">
                {user ? (
                  <>
                    <div className="font-medium text-zinc-900">{sanitize(user.fullName)}</div>
                    <div className="text-xs text-zinc-500">
                      {roleLabels[user.role] || user.role}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-medium text-zinc-900">Гость</div>
                    <div className="text-xs text-zinc-500">Не авторизован</div>
                  </>
                )}
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {user && (
              <>
                <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
                  <div className="text-sm font-medium">{sanitize(user.fullName)}</div>
                  <div className="text-xs font-normal text-zinc-500">{user.email}</div>
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            {user ? (
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Выйти</span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => { window.location.href = "/login" }}>
                <span>Войти</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}