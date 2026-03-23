"use client";

import type { SpreadsheetData } from "@/types";
import UploadZone from "./UploadZone";

interface Props {
  className?: string;
  spreadsheet: SpreadsheetData | null;
  onFileLoaded: (data: SpreadsheetData) => void;
}

export default function Sidebar({ className, spreadsheet, onFileLoaded }: Props) {
  return (
    <aside className={`sidebar ${className || ""}`.trim()}>
      <div className="sidebar-label">Planilha</div>
      <UploadZone onFileLoaded={onFileLoaded} />

      {spreadsheet && (
        <>
          <div className="file-info visible">
            <div className="file-icon">
              <i className="ri-file-excel-2-line" />
            </div>
            <div className="file-details">
              <div className="file-name">{spreadsheet.fileName}</div>
              <div className="file-meta">
                {spreadsheet.rows} linhas · {spreadsheet.columns} colunas
              </div>
            </div>
          </div>

          <div className="preview-wrap visible">
            <div className="sidebar-label">Previa</div>
            <div className="preview-scroll">
              <table className="preview-table">
                <thead>
                  <tr>
                    {spreadsheet.headers.map((h, i) => (
                      <th key={i}>{String(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {spreadsheet.rawRows.slice(0, 8).map((row, ri) => (
                    <tr key={ri}>
                      {spreadsheet.headers.map((_, ci) => (
                        <td key={ci}>{row[ci] !== undefined ? String(row[ci]) : ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
