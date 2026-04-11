"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Download, FileText, FileSpreadsheet, File, ChevronRight, ChevronDown, Upload, FolderPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

const typeConfig: Record<string, { variant: "destructive" | "default" | "outline"; icon: typeof FileText; label: string }> = {
  pdf: { variant: "destructive", icon: FileText, label: "PDF" },
  docx: { variant: "default", icon: File, label: "DOCX" },
  xlsx: { variant: "outline", icon: FileSpreadsheet, label: "XLSX" },
};

interface Section {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  _count: { documents: number };
}

interface RegDoc {
  id: string;
  title: string;
  sectionId: string;
  fileUrl: string;
  fileType: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  section: { name: string };
  createdBy: { fullName: string };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Build tree from flat sections
function buildTree(sections: Section[]): Map<string, Section[]> {
  const tree = new Map<string, Section[]>();
  sections.forEach((s) => {
    const parent = s.parentId || "__root__";
    if (!tree.has(parent)) tree.set(parent, []);
    tree.get(parent)!.push(s);
  });
  return tree;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<RegDoc[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [tree, setTree] = useState<Map<string, Section[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [userRole, setUserRole] = useState<string>("");

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadSection, setUploadSection] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");

  // Section creation dialog
  const [sectionOpen, setSectionOpen] = useState(false);
  const [creatingSection, setCreatingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionParent, setNewSectionParent] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me", { credentials: "include" }).then((r) => r.ok ? r.json() : null),
      fetch("/api/documents/sections", { credentials: "include" }).then((r) => r.ok ? r.json() : { data: [] }),
      fetch("/api/documents/regulatory", { credentials: "include" }).then((r) => r.ok ? r.json() : { data: [] }),
    ]).then(([user, secs, docs]) => {
      if (user?.user?.role) setUserRole(user.user.role);
      const sectionsData = secs.data || [];
      setSections(sectionsData);
      setTree(buildTree(sectionsData));
      setDocuments(docs.data || []);
      setLoading(false);
    });
  }, []);

  const handleToggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredDocs = documents.filter((d) => {
    const matchesSearch = search === "" || d.title.toLowerCase().includes(search.toLowerCase());
    const matchesSection = selectedSection === null || d.sectionId === selectedSection;
    return matchesSearch && matchesSection;
  });

  const isHSE = userRole === "admin" || userRole === "factory_hse";

  async function handleUpload() {
    if (!uploadFile || !uploadTitle.trim() || !uploadSection) {
      setUploadError("Заполните все поля");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("title", uploadTitle.trim());
      formData.append("sectionId", uploadSection);
      formData.append("fileType", uploadFile.name.split(".").pop()?.toLowerCase() || "");

      const res = await fetch("/api/documents/regulatory", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        setUploadError(data.error || "Ошибка при загрузке");
        return;
      }
      // Refresh
      const docsRes = await fetch("/api/documents/regulatory", { credentials: "include" });
      if (docsRes.ok) setDocuments((await docsRes.json()).data || []);
      setUploadOpen(false);
      setUploadTitle("");
      setUploadSection("");
      setUploadFile(null);
    } catch {
      setUploadError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setUploading(false);
    }
  }

  async function handleCreateSection() {
    if (!newSectionName.trim()) {
      setSectionError("Введите название раздела");
      return;
    }
    setCreatingSection(true);
    setSectionError("");
    try {
      const res = await fetch("/api/documents/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSectionName.trim(),
          parentId: newSectionParent,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSectionError(data.error || "Ошибка при создании раздела");
        return;
      }
      // Refresh sections
      const secsRes = await fetch("/api/documents/sections", { credentials: "include" });
      if (secsRes.ok) {
        const secsData = (await secsRes.json()).data || [];
        setSections(secsData);
        setTree(buildTree(secsData));
      }
      setSectionOpen(false);
      setNewSectionName("");
      setNewSectionParent(null);
    } catch {
      setSectionError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setCreatingSection(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  // Recursive section tree
  function renderSectionTree(parentId: string, depth: number = 0) {
    const children = tree.get(parentId) || [];
    return children.map((section) => (
      <div key={section.id}>
        <button
          onClick={() => handleToggleSection(section.id)}
          className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md hover:bg-zinc-100 transition-colors ${
            selectedSection === section.id ? "bg-blue-50 text-blue-700" : ""
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {expandedSections.has(section.id) ? (
            <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
          )}
          <span className="text-sm truncate">{section.name}</span>
          <span className="text-xs text-zinc-400 ml-auto">{section._count.documents}</span>
        </button>
        {expandedSections.has(section.id) && renderSectionTree(section.id, depth + 1)}
      </div>
    ));
  }

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Sidebar — sections tree */}
      <aside className="w-64 border-r border-zinc-200 bg-zinc-50 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <h3 className="text-sm font-medium text-zinc-900">Разделы</h3>
          {isHSE && (
            <button
              onClick={() => setSectionOpen(true)}
              className="text-zinc-400 hover:text-zinc-600 transition-colors"
              title="Добавить раздел"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <button
            onClick={() => setSelectedSection(null)}
            className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md hover:bg-zinc-100 transition-colors ${
              selectedSection === null ? "bg-blue-50 text-blue-700" : ""
            }`}
          >
            <span className="text-sm">Все документы</span>
            <span className="text-xs text-zinc-400 ml-auto">{documents.length}</span>
          </button>
          {renderSectionTree("__root__")}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Нормативные документы ВШЗ
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              База нормативных документов завода
            </p>
          </div>
          {isHSE && (
            <Button variant="default" size="lg" onClick={() => setUploadOpen(true)}>
              <Plus />
              Добавить документ
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Поиск по названию..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left font-medium px-4 py-3">Наименование</th>
                <th className="text-left font-medium px-4 py-3">Тип</th>
                <th className="text-left font-medium px-4 py-3">Версия</th>
                <th className="text-left font-medium px-4 py-3">Раздел</th>
                <th className="text-left font-medium px-4 py-3">Дата обновления</th>
                <th className="text-right font-medium px-4 py-3">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-zinc-500">
                    Документы не найдены
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => {
                  const cfg = typeConfig[doc.fileType] || typeConfig.pdf;
                  const Icon = cfg.icon;
                  return (
                    <tr key={doc.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-900">{doc.title}</td>
                      <td className="px-4 py-3">
                        <Badge variant={cfg.variant} className="inline-flex items-center gap-1">
                          <Icon className="size-3" />
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">v{doc.version}</td>
                      <td className="px-4 py-3 text-zinc-600">{doc.section?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-600 font-mono text-xs">{formatDate(doc.updatedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={`/api/documents/regulatory/${doc.id}`}
                          download
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                        >
                          <Download className="h-4 w-4" />
                          Скачать
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-zinc-400">
          Показано {filteredDocs.length} из {documents.length} документов
        </div>
      </div>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить нормативный документ</DialogTitle>
            <DialogDescription>
              Загрузите файл и выберите раздел
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Файл *</Label>
              <Input
                type="file"
                accept=".pdf,.docx,.xlsx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setUploadFile(file);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Наименование *</Label>
              <Input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Название документа"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Раздел *</Label>
              <Select value={uploadSection} onValueChange={(v) => setUploadSection(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите раздел" />
                </SelectTrigger>
                <SelectContent>
                  {sections.filter((s) => s.parentId === null).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); setUploadError(""); }} disabled={uploading}>
              Отмена
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Загрузить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Section creation dialog */}
      <Dialog open={sectionOpen} onOpenChange={setSectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать раздел</DialogTitle>
            <DialogDescription>
              Укажите название и родительский раздел
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Название раздела *</Label>
              <Input
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="Название"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Родительский раздел</Label>
              <Select value={newSectionParent ?? ""} onValueChange={(v) => setNewSectionParent(v === "" ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Без родителя (корневой)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Без родителя —</SelectItem>
                  {sections.filter((s) => s.parentId === null).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {sectionError && <p className="text-sm text-red-600">{sectionError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSectionOpen(false); setSectionError(""); }} disabled={creatingSection}>
              Отмена
            </Button>
            <Button onClick={handleCreateSection} disabled={creatingSection}>
              {creatingSection && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
