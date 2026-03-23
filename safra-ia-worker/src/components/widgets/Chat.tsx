"use client";

import { useRef, useEffect } from "react";
import type { ChatMessage } from "@/types";
import { formatMarkdown } from "@/lib/format";

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
  hasSpreadsheet: boolean;
  suggestions: string[];
  loadingSuggestions: boolean;
  onSend: (text: string) => void;
}

export default function Chat({ messages, isLoading, hasSpreadsheet, suggestions, loadingSuggestions, onSend }: Props) {
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  function handleSend() {
    const text = textareaRef.current?.value.trim();
    if (!text) return;
    onSend(text);
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = "auto";
    }
  }

  return (
    <div className="chat-area">
      <div className="messages" ref={messagesRef}>
        {messages.length === 0 && !isLoading ? (
          <div className="welcome">
            <div className="welcome-icon">
              <i className="ri-chat-3-line" />
            </div>
            <div className="welcome-title">Pronto para analisar</div>
            <div className="welcome-sub">
              Faça o upload de uma planilha ao lado e comece a fazer perguntas sobre os seus dados.
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role === "user" ? "user" : "ai"}`}>
                <div className="message-role">{msg.role === "user" ? "Você" : "Safra IA"}</div>
                <div
                  className="bubble"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                />
              </div>
            ))}
            {!isLoading && (loadingSuggestions || suggestions.length > 0) && (
              <div className="suggestions">
                {loadingSuggestions ? (
                  <>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="skeleton-btn">
                        <div className="skeleton-line" style={{ width: `${60 + i * 8}%` }} />
                      </div>
                    ))}
                  </>
                ) : (
                  suggestions.map((s, i) => (
                    <button key={i} className="suggestion-btn" onClick={() => onSend(s)}>
                      {s}
                    </button>
                  ))
                )}
              </div>
            )}
            {isLoading && (
              <div className="message ai">
                <div className="message-role">Safra IA</div>
                <div className="bubble">
                  <div className="typing-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {hasSpreadsheet && (
        <div className="input-bar">
          <div className="input-row">
            <div className="input-wrap">
              <textarea
                ref={textareaRef}
                className="input-field"
                placeholder="Faça uma pergunta sobre os dados..."
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 100) + "px";
                }}
              />
            </div>
            <button className="send-btn" disabled={isLoading} onClick={handleSend}>
              <i className="ri-send-plane-fill" />
            </button>
          </div>
          <div className="input-hint">Enter para enviar · Shift+Enter para nova linha</div>
        </div>
      )}
    </div>
  );
}
