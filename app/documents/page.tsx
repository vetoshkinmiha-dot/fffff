"use client";

import { useState, useEffect } from "react";
import {
  Plus, Search, Download, FileText, FileSpreadsheet, File, ChevronRight,
  ChevronDown, Upload, FolderPlus, Pencil, Trash2, Loader2, Edit3, Eye
} from "lucide-react";
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

  // Can this user add documents?
  const canAdd = ["admin", "employee", "department_approver"].includes(userRole);
  // Can this user edit/delete documents?
  const canManage = userRole === "admin";

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

  // Edit document dialog
  const [editDoc, setEditDoc] = useState<RegDoc | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSection, setEditSection] = useState("");
  const [savingDoc, setSavingDoc] = useState(false);
  const [editError, setEditError] = useState("");

  // Edit section dialog
  const [editSectionData, setEditSectionData] = useState<Section | null>(null);
  const [editSectionName, setEditSectionName] = useState("");
  const [savingSection, setSavingSection] = useState(false);
  const [editSectionErr, setEditSectionErr] = useState("");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: "doc" | "section"; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);
  const limit = 20;

  // File preview
  const [previewDoc, setPreviewDoc] = useState<{ id: string; title: string; fileUrl: string; fileType: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me", { credentials: "include" }).then((r) => r.ok ? r.json() : null),
      fetch("/api/documents/sections", { credentials: "include" }).then((r) => r.ok ? r.json() : { data: [] }),
    ]).then(([user, secs]) => {
      if (user?.user?.role) setUserRole(user.user.role);
      const sectionsData = secs.data || [];
      setSections(sectionsData);
      setTree(buildTree(sectionsData));
    }).finally(() => setLoading(false));
  }, []);

  const fetchDocuments = async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      if (selectedSection) params.set("sectionId", selectedSection);
      const res = await fetch(`/api/documents/regulatory?${params}`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setDocuments(json.data || []);
        setTotalPages(json.pagination?.pages ?? 1);
        setTotalDocs(json.pagination?.total ?? 0);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [page, search, selectedSection]);

  // Reset page when search or section filter changes
  useEffect(() => {
    setPage(1);
  }, [search, selectedSection]);

  const refreshDocuments = async () => {
    await fetchDocuments();
  };

  const refreshSections = async () => {
    const res = await fetch("/api/documents/sections", { credentials: "include" });
    if (res.ok) {
      const secsData = (await res.json()).data || [];
      setSections(secsData);
      setTree(buildTree(secsData));
    }
  };

  const handleToggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function handleDownloadDoc(docId: string, title: string) {
    try {
      const res = await fetch(`/api/documents/regulatory/${docId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = title;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Ошибка при скачивании файла");
    }
  }

  const filteredDocs = documents;

  async function handleUpload() {
    if (!uploadFile || !uploadTitle.trim() || !uploadSection) {
      setUploadError("Файл, наименование и раздел обязательны");
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
      await refreshDocuments();
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
      await refreshSections();
      setSectionOpen(false);
      setNewSectionName("");
      setNewSectionParent(null);
    } catch {
      setSectionError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setCreatingSection(false);
    }
  }

  async function handleEditDoc() {
    if (!editDoc || !editTitle.trim() || !editSection) {
      setEditError("Наименование и раздел обязательны");
      return;
    }
    setSavingDoc(true);
    setEditError("");
    try {
      const res = await fetch(`/api/documents/regulatory/${editDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: editTitle.trim(), sectionId: editSection }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error || "Ошибка при сохранении");
        return;
      }
      await refreshDocuments();
      setEditDoc(null);
    } catch {
      setEditError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setSavingDoc(false);
    }
  }

  async function handleEditSection() {
    if (!editSectionData || !editSectionName.trim()) {
      setEditSectionErr("Введите название раздела");
      return;
    }
    setSavingSection(true);
    setEditSectionErr("");
    try {
      const res = await fetch(`/api/documents/sections/${editSectionData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: editSectionName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditSectionErr(data.error || "Ошибка при сохранении");
        return;
      }
      await refreshSections();
      setEditSectionData(null);
    } catch {
      setEditSectionErr("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setSavingSection(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const endpoint = deleteTarget.type === "doc"
        ? `/api/documents/regulatory/${deleteTarget.id}`
        : `/api/documents/sections/${deleteTarget.id}`;
      const res = await fetch(endpoint, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Ошибка при удалении");
        return;
      }
      if (deleteTarget.type === "doc") {
        await refreshDocuments();
      } else {
        await refreshSections();
        if (selectedSection === deleteTarget.id) setSelectedSection(null);
      }
      setDeleteTarget(null);
    } catch {
      alert("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  function renderSectionTree(parentId: string, depth: number = 0) {
    const children = tree.get(parentId) || [];
    return children.map((section) => (
      <div key={section.id}>
        <div className="group flex items-center gap-1">
          <button
            onClick={() => handleToggleSection(section.id)}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 transition-colors shrink-0"
          >
            {expandedSections.has(section.id) ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setSelectedSection(section.id)}
            className={`flex items-center min-h-[32px] gap-2 flex-1 text-left px-2 py-1.5 rounded-md transition-all duration-200 ${
              selectedSection === section.id ? "bg-blue-50 text-blue-700 font-medium" : "hover:bg-zinc-100"
            }`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            <span className="text-sm truncate">{section.name}</span>
            <span className="text-xs text-zinc-400 ml-auto shrink-0">{section._count.documents}</span>
          </button>
          {canManage && (
            <div className="hidden group-hover:flex items-center gap-0.5 mr-1 shrink-0">
              <button
                onClick={() => {
                  setEditSectionData(section);
                  setEditSectionName(section.name);
                }}
                className="p-1 text-zinc-400 hover:text-blue-600 transition-colors"
                title="Редактировать раздел"
              >
                <Edit3 className="h-3 w-3" />
              </button>
              <button
                onClick={() => setDeleteTarget({ type: "section", id: section.id, name: section.name })}
                className="p-1 text-zinc-400 hover:text-red-600 transition-colors"
                title="Удалить раздел"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        {expandedSections.has(section.id) && renderSectionTree(section.id, depth + 1)}
      </div>
    ));
  }

  return (
    <div className="flex flex-col md:flex-row -m-6 h-[calc(100vh-56px)]">
      {/* Mobile section selector */}
      <div className="md:hidden w-full px-4 py-3 border-b border-zinc-200 bg-zinc-50">
        <Select value={selectedSection || ""} onValueChange={(v) => setSelectedSection(v || null)}>
          <SelectTrigger>
            <SelectValue placeholder="Выберите раздел" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Все документы</SelectItem>
            {sections.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sidebar — sections tree (desktop only) */}
      <aside className="hidden md:flex w-64 border-r border-zinc-200 bg-zinc-50 flex flex-col shrink-0">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <h3 className="text-sm font-medium text-zinc-900">Разделы</h3>
          {canManage && (
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
            className={`flex items-center min-h-[32px] gap-2 w-full text-left px-2 py-1.5 rounded-md transition-colors ${
              selectedSection === null ? "bg-blue-50 text-blue-700 font-medium" : "hover:bg-zinc-100"
            }`}
          >
            <span className="text-sm">Все документы</span>
            <span className="text-xs text-zinc-400 ml-auto">{totalDocs}</span>
          </button>
          {renderSectionTree("__root__")}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 min-w-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Нормативные документы ВШЗ
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              База нормативных документов завода
            </p>
          </div>
          {canAdd && (
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

        {/* Desktop table */}
        <div className="hidden md:block rounded-xl border border-zinc-200 bg-white overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: "max-content" }}>
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
                  <td colSpan={6} className="py-8">
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-sm text-zinc-500">Документы не найдены</p>
                      {canAdd && (
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setUploadOpen(true)}>
                          <Upload className="h-4 w-4" />
                          Загрузить документ
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => {
                  const cfg = typeConfig[doc.fileType] || typeConfig.pdf;
                  const Icon = cfg.icon;
                  return (
                    <tr key={doc.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors duration-200">
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
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setPreviewDoc({ id: doc.id, title: doc.title, fileUrl: doc.fileUrl, fileType: doc.fileType })}
                            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-blue-600"
                            title="Просмотр"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadDoc(doc.id, doc.title)}
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                          >
                            <Download className="h-4 w-4" />
                            Скачать
                          </button>
                          {canManage && (
                            <>
                              <button
                                onClick={() => {
                                  setEditDoc(doc);
                                  setEditTitle(doc.title);
                                  setEditSection(doc.sectionId);
                                }}
                                className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-blue-600"
                                title="Редактировать"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget({ type: "doc", id: doc.id, name: doc.title })}
                                className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-red-600"
                                title="Удалить"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {filteredDocs.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-zinc-500">Документы не найдены</p>
              {canAdd && (
                <Button variant="outline" size="sm" className="gap-1.5 mt-3" onClick={() => setUploadOpen(true)}>
                  <Upload className="h-4 w-4" />
                  Загрузить документ
                </Button>
              )}
            </div>
          ) : (
            filteredDocs.map((doc) => {
              const cfg = typeConfig[doc.fileType] || typeConfig.pdf;
              const Icon = cfg.icon;
              return (
                <div key={doc.id} className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-900 flex-1">{doc.title}</span>
                    <Badge variant={cfg.variant} className="inline-flex items-center gap-1 shrink-0">
                      <Icon className="size-3" />
                      {cfg.label}
                    </Badge>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {doc.section?.name ?? "—"} &bull; v{doc.version} &bull; {formatDate(doc.updatedAt)}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setPreviewDoc({ id: doc.id, title: doc.title, fileUrl: doc.fileUrl, fileType: doc.fileType })}
                      className="flex-1 inline-flex items-center justify-center gap-1 text-sm text-zinc-500 hover:text-blue-600 border border-zinc-200 rounded-md px-3 py-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Просмотр
                    </button>
                    <button
                      onClick={() => handleDownloadDoc(doc.id, doc.title)}
                      className="flex-1 inline-flex items-center justify-center gap-1 text-sm text-blue-600 border border-blue-200 rounded-md px-3 py-1.5 hover:bg-blue-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Скачать
                    </button>
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditDoc(doc); setEditTitle(doc.title); setEditSection(doc.sectionId); }}
                        className="flex-1 inline-flex items-center justify-center gap-1 text-sm text-zinc-500 hover:text-blue-600 border border-zinc-200 rounded-md px-3 py-1.5"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Редактировать
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ type: "doc", id: doc.id, name: doc.title })}
                        className="flex-1 inline-flex items-center justify-center gap-1 text-sm text-red-600 hover:text-red-700 border border-red-200 rounded-md px-3 py-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Удалить
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-400">
              Показано {documents.length} из {totalDocs} документов
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Страница {page} из {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Назад
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Вперёд
              </Button>
            </div>
          </div>
        )}
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
              <Select value={uploadSection} onValueChange={(v) => { if (v !== null) setUploadSection(v); }} itemToStringLabel={(v) => sections.find((s) => s.id === v)?.name ?? v}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите раздел">{(v: string) => v ? (sections.find((s) => s.id === v)?.name ?? v) : "Выберите раздел"}</SelectValue>
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
              <Select value={newSectionParent ?? ""} onValueChange={(v) => setNewSectionParent(v === "" ? null : v)} itemToStringLabel={(v) => (v ? sections.find((s) => s.id === v)?.name ?? v : "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Без родителя (корневой)">{(v: string) => v ? sections.find((s) => s.id === v)?.name ?? "" : "Без родителя (корневой)"}</SelectValue>
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

      {/* Edit document dialog */}
      <Dialog open={!!editDoc} onOpenChange={(open) => { if (!open) setEditDoc(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать документ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Наименование *</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Раздел *</Label>
              <Select value={editSection} onValueChange={(v) => { if (v !== null) setEditSection(v); }} itemToStringLabel={(v) => sections.find((s) => s.id === v)?.name ?? v}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите раздел">{(v: string) => v ? (sections.find((s) => s.id === v)?.name ?? v) : "Выберите раздел"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sections.filter((s) => s.parentId === null).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editError && <p className="text-sm text-red-600">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDoc(null)} disabled={savingDoc}>
              Отмена
            </Button>
            <Button onClick={handleEditDoc} disabled={savingDoc}>
              {savingDoc && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit section dialog */}
      <Dialog open={!!editSectionData} onOpenChange={(open) => { if (!open) setEditSectionData(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать раздел</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Название раздела *</Label>
              <Input
                value={editSectionName}
                onChange={(e) => setEditSectionName(e.target.value)}
              />
            </div>
            {editSectionErr && <p className="text-sm text-red-600">{editSectionErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSectionData(null)} disabled={savingSection}>
              Отмена
            </Button>
            <Button onClick={handleEditSection} disabled={savingSection}>
              {savingSection && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File preview dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) setPreviewDoc(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewDoc?.title ?? "Просмотр документа"}</DialogTitle>
            <DialogDescription>
              {previewDoc?.fileType === "pdf" ? "PDF документ" : previewDoc?.fileType === "docx" ? "Документ Word" : previewDoc?.fileType === "xlsx" ? "Таблица Excel" : "Файл"}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-[400px]">
            {previewDoc && previewDoc.fileType === "pdf" && (
              <iframe src={previewDoc.fileUrl} className="w-full h-[500px] rounded-md border border-zinc-200" title={previewDoc.title} />
            )}
            {previewDoc && ["image/jpeg", "image/png", "image/jpg", "jpg", "png", "jpeg"].some((t) => previewDoc.fileUrl.toLowerCase().endsWith("." + t) || previewDoc.fileType === t) && (
              <img src={previewDoc.fileUrl} alt={previewDoc.title} className="max-w-full rounded-md border border-zinc-200 mx-auto" />
            )}
            {previewDoc && ["docx", "xlsx"].includes(previewDoc.fileType) && !["image/jpeg", "image/png", "image/jpg", "jpg", "png", "jpeg"].some((t) => previewDoc.fileUrl.toLowerCase().endsWith("." + t)) && (
              <div className="flex flex-col items-center justify-center h-[300px] gap-4">
                <FileSpreadsheet className="h-16 w-16 text-zinc-300" />
                <p className="text-sm text-zinc-500">Предпросмотр данного формата не поддерживается</p>
                <Button onClick={() => { if (previewDoc) { handleDownloadDoc(previewDoc.id, previewDoc.title); setPreviewDoc(null); } }}>
                  <Download className="h-4 w-4 mr-2" />
                  Скачать
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтверждение удаления</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? deleteTarget.type === "doc"
                  ? `Удалить документ «${deleteTarget.name}»? Это действие нельзя отменить.`
                  : `Удалить раздел «${deleteTarget.name}»? Раздел не должен содержать документы или подразделы.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
