"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const departmentLabels: Record<string, string> = {
  hse: "ОТ и ПБ (HSE)",
  curator: "Куратор договора",
  procurement: "Закупки",
  quality: "Качество",
  legal: "Юридический отдел",
  finance: "Финансовый отдел",
  hr_department: "Отдел кадров",
};

interface Complaint {
  id: string;
  violationNumber: string;
  department: string;
  complaintText: string;
  createdAt: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function MyComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/my-organization/complaints", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setComplaints(data?.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Мои жалобы
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Жалобы, поданные вашей организацией
        </p>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border border-zinc-200 bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-medium">Номер нарушения</TableHead>
              <TableHead className="font-medium">Департамент</TableHead>
              <TableHead className="font-medium">Текст жалобы</TableHead>
              <TableHead className="font-medium">Дата</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-zinc-500">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : complaints.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-zinc-500">
                  Жалобы не найдены
                </TableCell>
              </TableRow>
            ) : (
              complaints.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs text-zinc-600">
                    {c.violationNumber}
                  </TableCell>
                  <TableCell className="text-sm text-zinc-600">
                    <Badge variant="outline">{departmentLabels[c.department] ?? c.department}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-900 max-w-md truncate">
                    {c.complaintText}
                  </TableCell>
                  <TableCell className="text-sm text-zinc-600">{formatDate(c.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="py-8 text-center text-sm text-zinc-500">Загрузка...</div>
        ) : complaints.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-500">Жалобы не найдены</div>
        ) : (
          complaints.map((c) => (
            <div key={c.id} className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{departmentLabels[c.department] ?? c.department}</Badge>
                <span className="font-mono text-xs text-zinc-500">{c.violationNumber}</span>
              </div>
              <div className="text-sm text-zinc-900 line-clamp-2">{c.complaintText}</div>
              <div className="text-xs text-zinc-500">{formatDate(c.createdAt)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
