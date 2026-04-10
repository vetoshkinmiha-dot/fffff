"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, X, FileText, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

interface FileUploadProps {
  employeeId: string;
  onUploaded: (doc: { id: string; name: string; issueDate: string | null; expiryDate: string | null; status: string; createdAt: string }) => void;
}

export function FileUpload({ employeeId, onUploaded }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fileName, setFileName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [docName, setDocName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Допустимые форматы: PDF, JPG, PNG";
    }
    if (file.size > MAX_SIZE) {
      return "Максимальный размер файла — 10 МБ";
    }
    return null;
  }, []);

  const handleFileSelect = useCallback(
    (file: File) => {
      setError("");
      setSuccess("");
      const err = validateFile(file);
      if (err) {
        setError(err);
        setSelectedFile(null);
        setFileName("");
        return;
      }
      setSelectedFile(file);
      setFileName(file.name);
      // Auto-fill doc name from filename (without extension)
      const baseName = file.name.replace(/\.[^.]+$/, "");
      setDocName(baseName);
    },
    [validateFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  async function handleUpload() {
    if (!selectedFile) return;
    if (!docName.trim()) {
      setError("Укажите наименование документа");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("name", docName.trim());
      if (expiryDate) formData.append("expiryDate", expiryDate);

      const res = await fetch(`/api/employees/${employeeId}/documents`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка при загрузке файла");
        return;
      }

      setSuccess("Документ успешно загружен");
      onUploaded(data);

      // Reset form
      setSelectedFile(null);
      setFileName("");
      setDocName("");
      setExpiryDate("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setUploading(false);
    }
  }

  function clearFile() {
    setSelectedFile(null);
    setFileName("");
    setDocName("");
    setError("");
    setSuccess("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
          dragOver
            ? "border-blue-400 bg-blue-50"
            : "border-zinc-200 bg-zinc-50 hover:border-zinc-300"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload className="h-8 w-8 text-zinc-400 mb-2" />
        <p className="text-sm text-zinc-600">
          Перетащите файл сюда или{" "}
          <button
            type="button"
            className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
            onClick={() => fileInputRef.current?.click()}
          >
            выберите
          </button>
        </p>
        <p className="mt-1 text-xs text-zinc-400">PDF, JPG, PNG • до 10 МБ</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {/* Selected file info */}
      {fileName && (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2">
          <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
          <span className="text-sm text-zinc-700 truncate flex-1">{fileName}</span>
          <span className="text-xs text-zinc-400">
            ({((selectedFile?.size ?? 0) / 1024).toFixed(0)} КБ)
          </span>
          <button type="button" onClick={clearFile} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Document name + expiry date */}
      {fileName && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="docName">Наименование документа</Label>
            <Input
              id="docName"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="Удостоверение, сертификат..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expiryDate">Срок действия</Label>
            <Input
              id="expiryDate"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Error / Success */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Upload button */}
      {fileName && (
        <Button onClick={handleUpload} disabled={uploading} className="w-full">
          {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Загрузить документ
        </Button>
      )}
    </div>
  );
}
