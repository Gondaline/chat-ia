export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SpreadsheetData {
  fileName: string;
  rows: number;
  columns: number;
  headers: string[];
  rawRows: unknown[][];
  text: string;
}
