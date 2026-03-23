export function formatMarkdown(text: string): string {
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/);
  let thinking = "";
  let answer = text;

  if (thinkMatch) {
    thinking = thinkMatch[1].trim();
    answer = text.replace(/<think>[\s\S]*?<\/think>/, "").trim();
  }

  const format = (t: string) =>
    t.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.*?)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br>");

  let html = "";
  if (thinking) {
    html += `<details class="thinking"><summary>Ver raciocínio</summary><div class="thinking-content">${format(thinking)}</div></details>`;
  }
  html += format(answer);

  return html;
}

export function buildSpreadsheetText(
  fileName: string,
  headers: string[],
  rows: unknown[][],
  maxRows = 200
): string {
  const limited = Math.min(rows.length, maxRows);
  let text = `Planilha: ${fileName}\nColunas: ${headers.join(", ")}\nTotal de linhas: ${rows.length}\n\nDados:\n`;
  text += headers.join("\t") + "\n";
  for (let i = 0; i < limited; i++) {
    text += (rows[i] as unknown[]).join("\t") + "\n";
  }
  if (rows.length > maxRows) {
    text += `\n... e mais ${rows.length - maxRows} linhas.`;
  }
  return text;
}