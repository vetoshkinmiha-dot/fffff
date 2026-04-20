"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CheckSquare,
  ClipboardCheck,
  FileText,
  LogOut,
  Search,
} from "lucide-react";
import { sanitize } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  type?: string;
  created_at?: string;
}

function timeAgo(date: Date | string): string {
  const now = new Date();
  const then = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return "только что";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const h = hours % 24;
    return h === 1 ? "1 ч назад" : h < 5 ? `${h} ч назад` : `${h} ч назад`;
  }
  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  if (days < 5) return `${days} дн назад`;
  return then.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

const typeIconMap: Record<string, React.ElementType> = {
  approval_decision: ClipboardCheck,
  new_document: BookOpen,
  checklist_assigned: CheckSquare,
  document_expiry: AlertTriangle,
  permit_expiry: FileText,
};

function getTypeIcon(type?: string) {
  const Icon = typeIconMap[type ?? ""] ?? Bell;
  return <Icon className="h-4 w-4 shrink-0" />;
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
    employee: "Сотрудник",
    contractor_admin: "Ответственный подрядчика",
    contractor_employee: "Сотрудник подрядчика",
    department_approver: "Согласующий",
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
            <span className="relative inline-flex items-center justify-center h-9 w-9 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors cursor-pointer">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
              )}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-h-[28rem] overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-3 py-2 border-b border-zinc-100">
              <p className="text-sm font-semibold">Уведомления</p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                  onClick={async () => {
                    await fetch("/api/notifications/me", {
                      method: "POST",
                      credentials: "include",
                    });
                    const r = await fetch("/api/notifications/me", { credentials: "include" });
                    const data: Notification[] = r.ok ? await r.json() : [];
                    setNotifications(data);
                    setUnreadCount(data.filter((n) => !n.read).length);
                  }}
                >
                  Прочитать все
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-zinc-400">
                Нет уведомлений
              </div>
            ) : (() => {
              const sorted = [...notifications].sort(
                (a, b) => Number(a.read) - Number(b.read)
              );
              const read = sorted.filter((n) => n.read);
              const items = sorted.slice(0, 10);
              const lastUnreadIdx = items.reduce(
                (max, n, i) => (!n.read ? i : max), -1
              );

              return items.map((n, idx) => {
                const isLastUnread = idx === lastUnreadIdx;
                const time = n.created_at ? timeAgo(n.created_at) : "";
                return (
                  <div key={n.id}>
                    <DropdownMenuItem
                      className="cursor-pointer flex items-start gap-3 px-3 py-2.5"
                      onClick={() => { if (n.link) window.location.href = n.link; }}
                    >
                      <div className="mt-0.5 text-zinc-400">
                        {getTypeIcon(n.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-1.5">
                          {!n.read && (
                            <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                          )}
                          <span className={`text-sm leading-snug ${!n.read ? "font-semibold" : "font-normal"}`}>
                            {sanitize(n.title)}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5 leading-snug line-clamp-2">
                          {sanitize(n.message)}
                        </p>
                        {time && (
                          <p className="text-[11px] text-zinc-400 mt-1">
                            {time}
                          </p>
                        )}
                      </div>
                    </DropdownMenuItem>
                    {isLastUnread && read.length > 0 && (
                      <div className="px-3 py-1 border-t border-zinc-100">
                        <span className="text-[11px] text-zinc-400 font-medium">Прочитанные</span>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
            {notifications.length > 10 && (
              <div className="px-3 py-2 border-t border-zinc-100">
                <a
                  href="/notifications"
                  className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  Посмотреть все
                </a>
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <span className="flex items-center gap-3 pl-4 border-l border-zinc-200 hover:opacity-80 transition-opacity cursor-pointer">
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
            </span>
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