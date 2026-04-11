"use client";

import { useState, useEffect } from "react";
import { notFound, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const categoryLabels: Record<string, string> = {
  hot_work: "Огневые работы",
  height_work: "Работы на высоте",
  confined_space: "Замкнутые пространства",
  electrical: "Электробезопасность",
  excavation: "Земляные работы",
  other: "Прочее",
};

const statusLabels: Record<string, string> = {
  draft: "Черновик",
  pending_approval: "На согласовании",
  approved: "Согласован",
  active: "Открыт",
  closed: "Закрыт",
  early_closed: "Закрыт досрочно",
  expired: "Истёк",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface Permit {
  id: string;
  permitNumber: string;
  category: string;
  workSite: string;
  responsiblePerson: string;
  openDate: string;
  expiryDate: string;
  status: string;
  closeReason: string | null;
  contractor: { name: string; sequentialNumber: number };
}

export default function PermitPrintPage() {
  const params = useParams();
  const id = params.id as string;
  const [permit, setPermit] = useState<Permit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPermit() {
      try {
        const res = await fetch(`/api/permits/${id}`, { credentials: "include" });
        if (res.status === 404) {
          notFound();
        } else if (res.ok) {
          setPermit(await res.json());
        }
      } catch {
        notFound();
      } finally {
        setLoading(false);
      }
    }
    fetchPermit();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!permit) {
    notFound();
    return null;
  }

  return (
    <div className="max-w-[210mm] mx-auto p-8 print:p-0 print:max-w-none print:w-full print:mx-0 print:bg-white">
      {/* Print button */}
      <div className="mb-6 print:hidden">
        <Button onClick={() => window.print()}>
          Печать
        </Button>
      </div>

      {/* Permit header */}
      <div className="border-b-2 border-black pb-4 mb-6">
        <h1 className="text-2xl font-bold">НАРЯД-ДОПУСК {permit.permitNumber}</h1>
        <p className="text-sm mt-1">ЗАО «ВШЗ» — Система управления подрядными организациями</p>
      </div>

      {/* Permit details table */}
      <table className="w-full border-collapse mb-6">
        <tbody>
          <tr>
            <td className="border border-black px-3 py-2 font-semibold w-1/3">Номер наряда</td>
            <td className="border border-black px-3 py-2">{permit.permitNumber}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-2 font-semibold">Категория работ</td>
            <td className="border border-black px-3 py-2">{categoryLabels[permit.category] ?? permit.category}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-2 font-semibold">Подрядная организация</td>
            <td className="border border-black px-3 py-2">{permit.contractor?.name ?? "—"}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-2 font-semibold">Участок работ</td>
            <td className="border border-black px-3 py-2">{permit.workSite}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-2 font-semibold">Ответственное лицо</td>
            <td className="border border-black px-3 py-2">{permit.responsiblePerson}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-2 font-semibold">Дата открытия</td>
            <td className="border border-black px-3 py-2">{formatDate(permit.openDate)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-2 font-semibold">Срок действия</td>
            <td className="border border-black px-3 py-2">{formatDate(permit.expiryDate)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-2 font-semibold">Статус</td>
            <td className="border border-black px-3 py-2">{statusLabels[permit.status] ?? permit.status}</td>
          </tr>
          {permit.closeReason && (
            <tr>
              <td className="border border-black px-3 py-2 font-semibold">Причина закрытия</td>
              <td className="border border-black px-3 py-2">{permit.closeReason}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Signatures */}
      <div className="mt-12 grid grid-cols-2 gap-8">
        <div>
          <p className="border-b border-black pb-1 mb-1">Выдал наряд:</p>
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
          <p className="border-b border-black pb-1 mb-1">Принял наряд:</p>
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

      {/* Print-only styles */}
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
