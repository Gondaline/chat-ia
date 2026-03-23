"use client";

import { useState, useCallback, useRef } from "react";
import type { ChatMessage, SpreadsheetData } from "@/types";
import Header from "@/components/layouts/Header";
import Sidebar from "@/components/widgets/Sidebar";
import Chat from "@/components/widgets/Chat";
import UploadZone from "@/components/widgets/UploadZone";

export default function Home() {
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleCancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsLoading(false);
  }, []);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const handleFileLoaded = useCallback((data: SpreadsheetData) => {
    setSpreadsheet(data);
    setSuggestions([]);
    const preview = data.headers.slice(0, 5).map((h) => `\`${h}\``).join(", ");
    const extra = data.headers.length > 5 ? ` e mais ${data.headers.length - 5}...` : "";
    setMessages([{
      role: "assistant",
      content: `Planilha **${data.fileName}** carregada! Encontrei **${data.rows} linhas** e **${data.columns} colunas**: ${preview}${extra}.\n\nComo posso te ajudar a analisar esses dados?`,
    }]);

    // Buscar sugestoes de perguntas baseadas na planilha
    setLoadingSuggestions(true);
    fetch("/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spreadsheetText: data.text }),
    })
      .then((res) => res.json())
      .then((res) => { if (res.suggestions?.length) setSuggestions(res.suggestions); })
      .catch(() => {})
      .finally(() => setLoadingSuggestions(false));
  }, []);

  const handleSend = useCallback(async (text: string) => {
    if (!spreadsheet || isLoading) return;

    setSuggestions([]);
    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetText: spreadsheet.text,
          messages: [...messages, userMsg].slice(-10),
        }),
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na API");

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "Desculpe, não consegui processar." },
      ]);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Cancelled by user — no error message needed
      } else {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        setMessages((prev) => [...prev, { role: "assistant", content: `Erro: ${msg}` }]);
      }
    }

    abortRef.current = null;
    setIsLoading(false);
  }, [spreadsheet, messages, isLoading]);

  return (
    <>
      <Header onToggleSidebar={toggleSidebar} hasSpreadsheet={!!spreadsheet} />
      <main className={`main${!spreadsheet ? " no-spreadsheet" : ""}`}>
        {/* Mobile-only: full-screen upload step */}
        <div className="mobile-upload-step">
          <div className="mobile-upload-content">
            <div className="mobile-upload-hero">
              <div className="mobile-upload-icon">
                <i className="ri-bar-chart-grouped-line" />
              </div>
              <h2 className="mobile-upload-title">Pronto para analisar</h2>
              <p className="mobile-upload-sub">
                Faça o upload de uma planilha e comece a fazer perguntas sobre os seus dados.
              </p>
            </div>
            <div className="mobile-upload-card">
              <UploadZone onFileLoaded={handleFileLoaded} />
              <div className="mobile-upload-formats">
                <span><i className="ri-file-excel-2-line" /> .xlsx</span>
                <span><i className="ri-file-excel-2-line" /> .xls</span>
                <span><i className="ri-file-text-line" /> .csv</span>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`sidebar-overlay${sidebarOpen ? " visible" : ""}`}
          onClick={closeSidebar}
        />
        <Sidebar
          className={sidebarOpen ? "open" : ""}
          spreadsheet={spreadsheet}
          suggestions={suggestions}
          loadingSuggestions={loadingSuggestions}
          onFileLoaded={(data) => { handleFileLoaded(data); closeSidebar(); }}
          onSuggestionClick={handleSend}
        />
        <Chat
          messages={messages}
          isLoading={isLoading}
          hasSpreadsheet={!!spreadsheet}
          onSend={handleSend}
          onCancel={handleCancel}
        />
      </main>
    </>
  );
}
