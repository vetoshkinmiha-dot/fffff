"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { sanitize } from "@/lib/utils";

interface EmployeeDoc {
  status: string;
}

interface OrgInfo {
  name: string;
  sequentialNumber: number;
}

interface Employee {
  id: string;
  fullName: string;
  position: string;
  organization: OrgInfo;
  workClasses: string[];
  documents: EmployeeDoc[];
  approvals: { status: string }[];
}

type DocCounts = {
  valid: number;
  expiring: number;
  expired: number;
};

type EmployeeWithDocs = Employee & { documentCounts: DocCounts };

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeWithDocs[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  // Unique orgs for filter dropdown
  const uniqueOrgs = useMemo(() => {
    const map = new Map<number, string>();
    employees.forEach((e) => map.set(e.organization.sequentialNumber, e.organization.name));
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [employees]);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search ? { search } : {}),
        ...(orgFilter !== "all" ? { organizationId: orgFilter } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      });
      const res = await fetch(`/api/employees?${params}`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setEmployees(json.data ?? []);
        setTotal(json.pagination?.total ?? 0);
        setTotalPages(json.pagination?.pages ?? 1);
      } else if (res.status === 401) {
        window.location.href = "/login";
      } else {
        setEmployees([]);
      }
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, orgFilter, statusFilter]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleStatusChange = useCallback(
    (value: string | null) => {
      setStatusFilter(value ?? "all");
      setPage(1);
    },
    []
  );

  const handleOrgChange = useCallback(
    (value: string | null) => {
      setOrgFilter(value ?? "all");
      setPage(1);
    },
    []
  );

  const approvalStatus = (approvals: { status: string }[]) => {
    const approved = approvals.filter((a) => a.status === "approved").length;
    const rejected = approvals.filter((a) => a.status === "rejected").length;
    const total = approvals.length;
    if (total === 0) return { label: "—", badge: null };
    if (rejected > 0) return { label: `${approved}/${total}`, badge: "rejected" };
    if (approved === total) return { label: `${approved}/${total}`, badge: "approved" };
    return { label: `${approved}/${total}`, badge: "pending" };
  };

  const docBadge = (counts: DocCounts) => {
    if (counts.expired > 0) return { text: `${counts.expired} проср.`, variant: "destructive" as const };
    if (counts.expiring > 0) return { text: `${counts.expiring} истекают`, variant: "secondary" as const };
    return { text: `${counts.valid} валидны`, variant: "outline" as const };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Сотрудники подрядчиков
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Реестр сотрудников подрядных организаций
          </p>
        </div>
        <Link href="/employees/new">
          <Button variant="default" size="lg">
            <Plus />
            Добавить сотрудника
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Поиск по ФИО..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select value={orgFilter} onValueChange={handleOrgChange}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Все организации" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все организации</SelectItem>
            {uniqueOrgs.map(([num, name]) => (
              <SelectItem key={num} value={String(num)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Все статусы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="approved">Согласованные</SelectItem>
            <SelectItem value="pending">В процессе</SelectItem>
            <SelectItem value="rejected">Отклонённые</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="max-w-[200px]">ФИО</TableHead>
              <TableHead className="max-w-[180px]">Организация</TableHead>
              <TableHead className="max-w-[180px]">Должность</TableHead>
              <TableHead className="max-w-[220px]">Классы работ</TableHead>
              <TableHead className="w-[120px]">Документы</TableHead>
              <TableHead className="w-[140px]">Согласования</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-zinc-500">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-zinc-500">
                  Сотрудники не найдены
                </TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => {
                const ap = approvalStatus(emp.approvals);
                const db = docBadge(emp.documentCounts);
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      <span title={emp.fullName}>{sanitize(emp.fullName)}</span>
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600 max-w-[180px] truncate">
                      <span title={emp.organization.name}>{sanitize(emp.organization.name)}</span>
                    </TableCell>
                    <TableCell className="text-sm text-zinc-500 max-w-[180px] truncate">
                      <span title={emp.position}>{sanitize(emp.position)}</span>
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <div className="flex flex-wrap gap-1">
                        {(emp.workClasses ?? []).slice(0, 2).map((wc) => (
                          <span
                            key={wc}
                            className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 whitespace-nowrap"
                          >
                            {wc}
                          </span>
                        ))}
                        {(emp.workClasses ?? []).length > 2 && (
                          <span className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-400">
                            +{(emp.workClasses ?? []).length - 2}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={db.variant}>{db.text}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-zinc-700">
                        {ap.label}
                      </span>
                      {ap.badge && (
                        <Badge
                          variant={ap.badge === "approved" ? "outline" : ap.badge === "rejected" ? "destructive" : "secondary"}
                          className="ml-1.5"
                        >
                          {ap.badge === "approved" ? "Согласован" : ap.badge === "rejected" ? "Отклонён" : "В процессе"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/employees/${emp.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="size-4 mr-1" />
                          Подробнее
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            Показано {employees.length} из {total} сотрудников
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Вперёд
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
