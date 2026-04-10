"use client";

import { useState, useEffect } from "react";
import { notFound, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const severityLabels: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  critical: "Критический",
};

const statusLabels: Record<string, string> = {
  pending: "Ожидает",
  resolved: "Устранено",
  escalated: "Эскалировано",
};

const departmentLabels: Record<string, string> = {
  hse: "ОТ и ПБ (HSE)",
  curator: "Куратор договора",
  procurement: "Закупки",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface Violation {
  id: string;
  date: string;
  description: string;
  severity: string;
  status: string;
  contractor: { name: string; sequentialNumber: number };
  reportedBy: string;
  resolutionNotes: string | null;
  resolvedAt: string | null;
}

export default function ViolationPrintPage() {
  const params = useParams();
  const id = params.id as string;
  const [violation, setViolation] = useState<Violation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchViolation() {
      try {
        const res = await fetch(`/api/violations/${id}`, { credentials: "include" });
        if (res.status === 404) {
          notFound();
        } else if (res.ok) {
          setViolation(await res.json());
        }
      } catch {
        notFound();
      } finally {
        setLoading(false);
      }
    }
    fetchViolation();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!violation) {
    notFound();
    return null;
  }

  return (
    <div className="max-w-[210mm] mx-auto p-8">
      {/* Print button */}
      <div className="mb-6 no-print">
        <Button onClick={() => window.print()}>
          Печать
        </Button>
      </div>

      {/* Header */}
      <div className="border-b-2 border-black pb-4 mb-6">
        <h1 className="text-2xl font-bold">АКТ НАРУШЕНИЯ</h1>
        <p className="text-sm mt-1">ЗАО «ВШЗ» — Система управления подрядными организациями</p>
      </div>

      {/* Details table */}
      <table className="w-full border-collapse mb-6">
        <tbody>
          <tr>
            <td className="border border-black px-3 py-2 font-semibold w-1/3">Дата нарушения</td>
            <td className="border border-black px-3 py-2">{formatDate(violation.date)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-2 font-semibold">Подрядная организация</td>
            <td className="border border-black px-3 py-2">{violation.contractor?.name ?? "—"}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-2 font-semibold">Департамент</td>
            <td className="border border-black px-3 py-2">{departmentLabels[violation.department] ?? "—"}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-2 font-semibold">Тяжесть нарушения</td>
            <td className="border border-black px-3 py-2">{severityLabels[violation.severity] ?? violation.severity}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-2 font-semibold">Статус</td>
            <td className="border border-black px-3 py-2">{statusLabels[violation.status] ?? violation.status}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-2 font-semibold">Описание нарушения</td>
            <td className="border border-black px-3 py-2 whitespace-pre-wrap">{violation.description}</td>
          </tr>
          {violation.resolutionNotes && (
            <tr>
              <td className="border border-black px-3 py-2 font-semibold">Решение</td>
              <td className="border border-black px-3 py-2 whitespace-pre-wrap">{violation.resolutionNotes}</td>
            </tr>
          )}
          {violation.resolvedAt && (
            <tr>
              <td className="border border-black px-3 py-2 font-semibold">Дата решения</td>
              <td className="border border-black px-3 py-2">{formatDate(violation.resolvedAt)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Signatures */}
      <div className="mt-12 grid grid-cols-2 gap-8">
        <div>
          <p className="border-b border-black pb-1 mb-1">Составил акт:</p>
          <div className="flex justify-between text-sm mt-8">
            <span className="border-b border-black w-32"></span>
            <span className="border-b border-black w-32"></span>
          </div>
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            <span>(подпись)</span>
            <span>(расшифровка)</span>
          </div>
        </div>
        <div>
          <p className="border-b border-black pb-1 mb-1">Принял:</p>
          <div className="flex justify-between text-sm mt-8">
            <span className="border-b border-black w-32"></span>
            <span className="border-b border-black w-32"></span>
          </div>
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            <span>(подпись)</span>
            <span>(расшифровка)</span>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 20mm; }
          table { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
