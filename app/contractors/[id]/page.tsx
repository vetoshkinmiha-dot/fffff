"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, MapPin, Mail, Hash, Loader2 } from "lucide-react";
import { sanitize } from "@/lib/utils";
import type { Contractor, Employee } from "@/app/types";
import { Badge } from "@/components/ui/badge";

const departmentLabels: Record<string, string> = {
  security: "Служба безопасности",
  hr: "Отдел кадров",
  safety: "Охрана труда (допуск)",
  safety_training: "Охрана труда (инструктаж)",
  permit_bureau: "Бюро пропусков",
};
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusConfig: Record<
  string,
  { variant: "outline" | "destructive" | "secondary"; label: string }
> = {
  active: { variant: "outline", label: "Активен" },
  pending: { variant: "secondary", label: "Ожидает" },
  blocked: { variant: "destructive", label: "Заблокирован" },
};

const approvalStatusMap: Record<string, { label: string; color: string }> = {
  approved: { label: "Одобрено", color: "text-emerald-600" },
  pending: { label: "В процессе", color: "text-amber-600" },
  rejected: { label: "Отклонено", color: "text-red-600" },
};

export default function ContractorDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const [orgRes, empRes, userRes] = await Promise.all([
          fetch(`/api/organizations/${id}`, { credentials: "include" }),
          fetch(`/api/employees?organizationId=${id}`, { credentials: "include" }),
          fetch("/api/auth/me", { credentials: "include" }),
        ]);

        if (!cancelled && userRes.ok) {
          const userData = await userRes.json();
          setUserRole(userData.user?.role || "");
        }

        if (cancelled) return;

        if (orgRes.ok) {
          setContractor(await orgRes.json());
        }

        if (empRes.ok) {
          const json = await empRes.json();
          setEmployees(json.data || []);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!contractor) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-zinc-500">Подрядчик не найден</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/contractors">
          <Button variant="ghost" size="icon-xs">
            <ArrowLeft />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {sanitize(contractor.name)}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Карточка подрядной организации
          </p>
        </div>
      </div>

      {/* Company info card */}
      <Card>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Статус
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`size-2 rounded-full ${contractor.status === "active" ? "bg-emerald-500" : contractor.status === "pending" ? "bg-amber-500" : "bg-red-500"}`}
                />
                <Badge variant={statusConfig[contractor.status].variant}>
                  {statusConfig[contractor.status].label}
                </Badge>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                ИНН
              </div>
              <div className="flex items-center gap-2 text-sm font-mono text-zinc-900">
                <Hash className="size-3.5 text-zinc-400" />
                {contractor.inn}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                КПП
              </div>
              <div className="text-sm text-zinc-900">
                {contractor.kpp || "—"}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Адрес
              </div>
              <div className="flex items-start gap-2 text-sm text-zinc-700">
                <MapPin className="size-3.5 text-zinc-400 mt-0.5 shrink-0" />
                {sanitize(contractor.legalAddress)}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Контакты
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-700">
                <Mail className="size-3.5 text-zinc-400" />
                <span>{sanitize(contractor.contactPersonName ?? "")} ({contractor.contactEmail ?? "—"})</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Сотрудников
              </div>
              <div className="text-sm text-zinc-900">
                {contractor._count?.employees ?? 0}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employees section — placeholder until employees API is ready */}
      <Card>
        <CardHeader>
          <CardTitle>Сотрудники</CardTitle>
          <CardDescription>
            Список работников подрядной организации
          </CardDescription>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-zinc-500">
                Сотрудники ещё не добавлены
              </p>
              {(userRole === "admin" || userRole === "contractor_employee") && (
              <Link href={`/employees/new?contractorId=${contractor.id}`}>
                <Button variant="outline" size="sm" className="mt-3">
                  Добавить сотрудника
                </Button>
              </Link>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-medium">ФИО</TableHead>
                  <TableHead className="font-medium">Должность</TableHead>
                  <TableHead className="font-medium">Классы допуска</TableHead>
                  <TableHead className="font-medium">Согласования</TableHead>
                  <TableHead className="font-medium">Документы</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => {
                  const pendingApprovals = emp.approvals.filter(
                    (a) => a.status === "pending"
                  ).length;
                  const rejectedApprovals = emp.approvals.filter(
                    (a) => a.status === "rejected"
                  ).length;
                  const expiredDocs = emp.documents.filter(
                    (d) => d.status === "expired"
                  ).length;

                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium text-zinc-900">
                        <Link
                          href={`/employees/${emp.id}`}
                          className="hover:text-zinc-700 transition-colors"
                        >
                          {emp.fullName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-zinc-600">
                        {emp.position}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="flex flex-wrap gap-1">
                          {emp.workClasses.slice(0, 3).map((cls) => (
                            <Badge key={cls} variant="outline" className="text-xs">
                              {cls}
                            </Badge>
                          ))}
                          {emp.workClasses.length > 3 && (
                            <span className="text-xs text-zinc-400">
                              +{emp.workClasses.length - 3}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-zinc-500">
                            {emp.approvals.length} всего
                          </span>
                          {pendingApprovals > 0 && (
                            <span className="text-amber-600 font-medium">
                              {pendingApprovals} ожидает
                            </span>
                          )}
                          {rejectedApprovals > 0 && (
                            <span className="text-red-600 font-medium">
                              {rejectedApprovals} отклонено
                            </span>
                          )}
                        </div>
                        <div className="mt-1 space-y-0.5">
                          {emp.approvals.map((a) => {
                            const info = approvalStatusMap[a.status];
                            return (
                              <div
                                key={`${a.department}-${a.status}-${a.id ?? 'none'}`}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="text-zinc-500">
                                  {departmentLabels[a.department] ?? a.department}
                                </span>
                                <span className={`font-medium ${info.color}`}>
                                  {info.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-xs">
                          {emp.documents.map((doc) => (
                            <span
                              key={doc.id}
                              className={`inline-flex items-center gap-1 ${
                                doc.status === "expired"
                                  ? "text-red-600"
                                  : doc.status === "expiring"
                                    ? "text-amber-600"
                                    : "text-zinc-500"
                              }`}
                            >
                              <span
                                className={`size-1.5 rounded-full ${
                                  doc.status === "expired"
                                    ? "bg-red-500"
                                    : doc.status === "expiring"
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                }`}
                              />
                              {doc.name}
                            </span>
                          ))}
                        </div>
                        {expiredDocs > 0 && (
                          <span className="mt-1 text-red-600 font-medium">
                            {expiredDocs} просрочено
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
