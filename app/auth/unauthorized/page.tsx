import Link from "next/link";
import { ShieldOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <ShieldOff className="h-8 w-8 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Доступ запрещён</h1>
          <p className="mt-2 text-sm text-zinc-500">
            У вас нет прав для доступа к этой странице. Обратитесь к администратору системы.
          </p>
        </div>
        <Link href="/">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Вернуться на главную
          </Button>
        </Link>
      </div>
    </div>
  );
}
