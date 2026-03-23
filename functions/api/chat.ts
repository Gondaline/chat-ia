interface Env {
  AI?: any; // Cloudflare Workers AI binding
  OPENROUTER_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
}

type Message = { role: string; content: string };

// --- Cloudflare Workers AI (no API key needed, built-in) ---
async function tryWorkersAI(
  ai: any,
  messages: Message[]
): Promise<string | null> {
  const models = [
    "@cf/meta/llama-3.1-8b-instruct",
    "@cf/meta/llama-3-8b-instruct",
    "@cf/mistral/mistral-7b-instruct-v0.2",
  ];

  for (const model of models) {
    try {
      const result = await ai.run(model, {
        messages,
        max_tokens: 2048,
        temperature: 0.3,
      });
      if (result?.response) return result.response;
    } catch {
      continue;
    }
  }
  return null;
}

// --- External HTTP providers (Gemini, Groq, OpenRouter) ---
interface HttpProvider {
  name: string;
  apiKey: string;
  models: string[];
  url: string;
  buildHeaders: (key: string) => Record<string, string>;
  buildBody: (model: string, msgs: Message[]) => unknown;
  extractReply: (data: any) => string | undefined;
  extractError: (data: any, status: string) => string;
}

function getHttpProviders(env: Env): HttpProvider[] {
  const providers: HttpProvider[] = [];

  if (env.GEMINI_API_KEY) {
    providers.push({
      name: "Gemini",
      apiKey: env.GEMINI_API_KEY,
      models: ["gemini-2.0-flash", "gemini-2.0-flash-lite"],
      url: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}",
      buildHeaders: () => ({ "Content-Type": "application/json" }),
      buildBody: (_model, msgs) => ({
        contents: msgs.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: 800, temperature: 0.3 },
      }),
      extractReply: (data: any) =>
        data?.candidates?.[0]?.content?.parts?.[0]?.text,
      extractError: (data: any, status) =>
        data?.error?.message || status,
    });
  }

  if (env.GROQ_API_KEY) {
    providers.push({
      name: "Groq",
      apiKey: env.GROQ_API_KEY,
      models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
      url: "https://api.groq.com/openai/v1/chat/completions",
      buildHeaders: (key) => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      }),
      buildBody: (model, msgs) => ({
        model,
        messages: msgs,
        max_tokens: 2048,
        temperature: 0.3,
      }),
      extractReply: (data: any) => data?.choices?.[0]?.message?.content,
      extractError: (data: any, status) =>
        data?.error?.message || status,
    });
  }

  if (env.OPENROUTER_API_KEY) {
    providers.push({
      name: "OpenRouter",
      apiKey: env.OPENROUTER_API_KEY,
      models: [
        "google/gemma-3-27b-it:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "mistralai/mistral-small-3.1-24b-instruct:free",
      ],
      url: "https://openrouter.ai/api/v1/chat/completions",
      buildHeaders: (key) => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      }),
      buildBody: (model, msgs) => ({
        model,
        messages: msgs,
        max_tokens: 2048,
        temperature: 0.3,
      }),
      extractReply: (data: any) => data?.choices?.[0]?.message?.content,
      extractError: (data: any, status) =>
        data?.error?.metadata?.raw || data?.error?.message || status,
    });
  }

  return providers;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { spreadsheetText, messages } = await context.request.json() as {
    spreadsheetText: string;
    messages: Message[];
  };

  const truncated = spreadsheetText.length > 12000
    ? spreadsheetText.slice(0, 12000) + "\n... (dados truncados por limite)"
    : spreadsheetText;

  const systemPrompt = `Você é um assistente especialista em análise de dados do Banco Safra. Responda perguntas sobre planilhas de forma clara e objetiva, sempre em português brasileiro.

Dados da planilha atual:
${truncated}

Regras:
- Responda sempre em português brasileiro
- Seja direto e objetivo
- Use negrito (**texto**) para destacar números e informações importantes
- Use código (\`texto\`) para nomes de colunas
- Quando calcular valores, mostre o resultado claramente
- Se não encontrar a informação, diga claramente
- Não invente dados que não estejam na planilha`;

  const fullMessages: Message[] = [
    { role: "user", content: systemPrompt },
    { role: "assistant", content: "Entendido. Pode perguntar." },
    ...messages,
  ];

  const providers = getHttpProviders(context.env);

  if (!context.env.AI && providers.length === 0) {
    return Response.json(
      { error: "Nenhum provider configurado. Configure o AI binding no wrangler.toml ou adicione uma API key." },
      { status: 500 }
    );
  }

  // Race all providers in parallel — first valid response wins
  const candidates: Promise<string>[] = [];

  // Workers AI candidates
  if (context.env.AI) {
    const models = [
      "@cf/meta/llama-3.1-8b-instruct",
      "@cf/meta/llama-3-8b-instruct",
    ];
    for (const model of models) {
      candidates.push(
        context.env.AI.run(model, { messages: fullMessages, max_tokens: 2048, temperature: 0.3 })
          .then((r: any) => {
            if (r?.response) return r.response;
            throw new Error("empty");
          })
      );
    }
  }

  // HTTP provider candidates
  for (const provider of providers) {
    for (const model of provider.models) {
      candidates.push(
        (async () => {
          const url = provider.url
            .replace("{model}", model)
            .replace("{key}", provider.apiKey);
          const res = await fetch(url, {
            method: "POST",
            headers: provider.buildHeaders(provider.apiKey),
            body: JSON.stringify(provider.buildBody(model, fullMessages)),
          });
          if (!res.ok) throw new Error(`${provider.name}: ${res.statusText}`);
          const data = await res.json();
          const reply = provider.extractReply(data);
          if (reply) return reply;
          throw new Error(`${provider.name}: empty`);
        })()
      );
    }
  }

  try {
    const reply = await Promise.any(candidates);
    return Response.json({ reply });
  } catch {
    return Response.json(
      { error: "Nenhum modelo disponível. Todos os providers falharam." },
      { status: 502 }
    );
  }
};
