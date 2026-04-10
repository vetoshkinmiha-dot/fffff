import { Bell, Search } from "lucide-react";

export default function Header() {
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
        <button className="relative inline-flex items-center justify-center h-9 w-9 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
        </button>
        <div className="flex items-center gap-3 pl-4 border-l border-zinc-200">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
            ИА
          </div>
          <div className="text-sm">
            <div className="font-medium text-zinc-900">Иванов А.С.</div>
            <div className="text-xs text-zinc-500">HSE Manager</div>
          </div>
        </div>
      </div>
    </header>
  );
}
