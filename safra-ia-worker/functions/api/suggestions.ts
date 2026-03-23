interface Env {
  AI?: any;
  OPENROUTER_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
}

async function generateWithWorkersAI(ai: any, prompt: string): Promise<string | null> {
  const models = [
    "@cf/meta/llama-3.1-8b-instruct",
    "@cf/meta/llama-3-8b-instruct",
  ];
  for (const model of models) {
    try {
      const result = await ai.run(model, {
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.5,
      });
      if (result?.response) return result.response;
    } catch {
      continue;
    }
  }
  return null;
}

interface HttpProvider {
  name: string;
  models: string[];
  url: string;
  headers: Record<string, string>;
  buildBody: (model: string, prompt: string) => unknown;
  extractText: (data: any) => string | undefined;
  apiKey: string;
}

function getProviders(env: Env): HttpProvider[] {
  const providers: HttpProvider[] = [];

  if (env.GEMINI_API_KEY) {
    providers.push({
      name: "Gemini",
      apiKey: env.GEMINI_API_KEY,
      models: ["gemini-2.0-flash", "gemini-2.0-flash-lite"],
      url: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}",
      headers: { "Content-Type": "application/json" },
      buildBody: (_model, prompt) => ({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 300, temperature: 0.5 },
      }),
      extractText: (data) => data?.candidates?.[0]?.content?.parts?.[0]?.text,
    });
  }

  if (env.GROQ_API_KEY) {
    providers.push({
      name: "Groq",
      apiKey: env.GROQ_API_KEY,
      models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
      url: "https://api.groq.com/openai/v1/chat/completions",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.GROQ_API_KEY}` },
      buildBody: (model, prompt) => ({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.5,
      }),
      extractText: (data) => data?.choices?.[0]?.message?.content,
    });
  }

  if (env.OPENROUTER_API_KEY) {
    providers.push({
      name: "OpenRouter",
      apiKey: env.OPENROUTER_API_KEY,
      models: [
        "google/gemma-3-27b-it:free",
        "meta-llama/llama-3.3-70b-instruct:free",
      ],
      url: "https://openrouter.ai/api/v1/chat/completions",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
      buildBody: (model, prompt) => ({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.5,
      }),
      extractText: (data) => data?.choices?.[0]?.message?.content,
    });
  }

  return providers;
}

function parseSuggestions(raw: string): string[] | null {
  const match = raw.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const suggestions = JSON.parse(match[0]);
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        return suggestions.slice(0, 4);
      }
    } catch { /* ignore */ }
  }
  return null;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { spreadsheetText } = await context.request.json() as {
    spreadsheetText: string;
  };

  const truncated = spreadsheetText.length > 8000
    ? spreadsheetText.slice(0, 8000) + "\n... (dados truncados)"
    : spreadsheetText;

  const prompt = `Analise esta planilha e gere exatamente 4 perguntas curtas e relevantes que um analista faria sobre esses dados. As perguntas devem ser específicas para os dados desta planilha, usando os nomes reais das colunas.

${truncated}

Responda APENAS com um JSON array de 4 strings, sem nenhum texto adicional. Exemplo: ["pergunta 1", "pergunta 2", "pergunta 3", "pergunta 4"]`;

  // 1) Try Workers AI first
  if (context.env.AI) {
    const raw = await generateWithWorkersAI(context.env.AI, prompt);
    if (raw) {
      const suggestions = parseSuggestions(raw);
      if (suggestions) return Response.json({ suggestions });
    }
  }

  // 2) Try external providers
  const providers = getProviders(context.env);

  for (const provider of providers) {
    for (const model of provider.models) {
      try {
        const url = provider.url
          .replace("{model}", model)
          .replace("{key}", provider.apiKey);

        const res = await fetch(url, {
          method: "POST",
          headers: provider.headers,
          body: JSON.stringify(provider.buildBody(model, prompt)),
        });

        if (!res.ok) continue;

        const data = await res.json();
        const raw = provider.extractText(data);
        if (raw) {
          const suggestions = parseSuggestions(raw);
          if (suggestions) return Response.json({ suggestions });
        }
      } catch {
        continue;
      }
    }
  }

  return Response.json({ suggestions: [] });
};
