// Sirve los assets estáticos de /public.
// - Fuerza HTTPS y el dominio canónico (www y *.workers.dev redirigen con 301).
// - Agrega cabeceras de seguridad a todas las respuestas.
// - En las respuestas HTML, la CSP lleva un nonce por request: Cloudflare (Bot Fight Mode,
//   JavaScript Detections) inyecta un script inline en el HTML y reutiliza ese nonce, así
//   el script queda permitido sin abrir 'unsafe-inline'.
// Dominio canónico OPCIONAL: se toma de la variable CANONICAL_HOST (wrangler.jsonc → vars).
// Si está vacía, solo se fuerza HTTPS y se sirve en el host que llegue (p. ej. *.workers.dev).

const STATIC_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

function csp(nonce) {
  return [
    "default-src 'self'",
    `script-src 'self'${nonce ? ` 'nonce-${nonce}'` : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function makeNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Canonicaliza: http → https y, si hay CANONICAL_HOST, www.* y *.workers.dev → dominio principal.
    const canonical = (env.CANONICAL_HOST || "").trim();
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const wrongHost = canonical && url.hostname !== canonical;
    if (!isLocal && (url.protocol !== "https:" || wrongHost)) {
      url.protocol = "https:";
      if (canonical) url.hostname = canonical;
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/api/health") {
      return withHeaders(Response.json({ ok: true, effective: "2026-10-01" }));
    }

    return withHeaders(await env.ASSETS.fetch(request));
  },
};

function withHeaders(res) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(STATIC_HEADERS)) out.headers.set(k, v);
  const isHtml = (out.headers.get("content-type") || "").includes("text/html");
  out.headers.set("Content-Security-Policy", csp(isHtml ? makeNonce() : null));
  return out;
}
