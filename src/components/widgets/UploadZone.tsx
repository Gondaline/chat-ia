"use client";

import { useRef, useState, useCallback } from "react";
import type { SpreadsheetData } from "@/types";
import { buildSpreadsheetText } from "@/lib/format";

interface Props {
  onFileLoaded: (data: SpreadsheetData) => void;
}

export default function UploadZone({ onFileLoaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragover, setDragover] = useState(false);
  const [error, setError] = useState("");

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(""), 4000);
  }

  const processFile = useCallback(
    async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !["csv", "xlsx", "xls"].includes(ext)) {
        showError("Formato inválido. Use CSV ou Excel.");
        return;
      }

      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];

      if (!json || json.length < 2) {
        showError("Planilha vazia ou sem dados suficientes.");
        return;
      }

      setError("");
      const headers = json[0] as string[];
      const rows = json.slice(1);

      onFileLoaded({
        fileName: file.name,
        rows: rows.length,
        columns: headers.length,
        headers,
        rawRows: rows,
        text: buildSpreadsheetText(file.name, headers, rows),
      });
    },
    [onFileLoaded]
  );

  return (
    <>
      <div
        className={`upload-zone${dragover ? " dragover" : ""}${error ? " error" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
        onDragLeave={() => setDragover(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragover(false);
          if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => {
            if (e.target.files?.[0]) processFile(e.target.files[0]);
          }}
        />
        <div className="upload-icon">
          <i className="ri-upload-cloud-2-line" />
        </div>
        <div className="upload-title">Arraste sua planilha aqui</div>
        <div className="upload-sub">CSV, Excel (.xlsx, .xls)</div>
      </div>
      {error && <div className="upload-error">{error}</div>}
    </>
  );
}
