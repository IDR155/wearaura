// WearAura — Proxy Mistral Pixtral
// La clé MISTRAL_KEY est stockée côté serveur via : supabase secrets set MISTRAL_KEY=...
// Elle n'est JAMAIS exposée au frontend.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Origines autorisées à appeler la fonction depuis un navigateur.
// Tout autre site web sera bloqué par le CORS.
const ALLOWED_ORIGINS = new Set([
  "https://wearaura.fr",
  "https://www.wearaura.fr",
  // Tests locaux (Live Server VS Code + npx serve)
  "http://localhost:3333",
  "http://localhost:5500",
  "http://127.0.0.1:3333",
  "http://127.0.0.1:5500",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://wearaura.fr",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const CORS = corsHeaders(req);

  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { dataUrl, prompt } = await req.json();

    if (!dataUrl || !prompt) {
      return new Response(JSON.stringify({ error: "dataUrl et prompt requis" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const key = Deno.env.get("MISTRAL_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "MISTRAL_KEY non configurée" }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "pixtral-12b-latest",
        messages: [{
          role: "user",
          content: [
            { type: "text",      text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        }],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
