/*
 * Web Push (RFC 8291 "aes128gcm" + RFC 8292 VAPID), implemented with WebCrypto
 * only — no dependencies. Runs unchanged in Cloudflare Workers and Node >= 20
 * (both expose globalThis.crypto.subtle). The encryption is exercised against
 * the RFC 8291 Appendix A vector by scripts/webpush-selftest.mjs.
 */

const enc = new TextEncoder();

// ── base64url ──────────────────────────────────────────────────────────────
export function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function bytesToB64url(bytes) {
  let bin = "";
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function concat(...arrs) {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

// ── HKDF via raw HMAC-SHA-256 (only single-block expands are needed) ─────────
async function hmac(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, dataBytes));
}
async function hkdf(salt, ikm, info, length) {
  const prk = await hmac(salt, ikm);                         // Extract
  const okm = await hmac(prk, concat(info, new Uint8Array([1]))); // Expand (T(1))
  return okm.slice(0, length);
}

// EC public point (65-byte uncompressed 0x04||x||y) → JWK coords.
function pointToXY(pub65) {
  return { x: bytesToB64url(pub65.slice(1, 33)), y: bytesToB64url(pub65.slice(33, 65)) };
}

// ── aes128gcm content encryption (RFC 8291 §3, RFC 8188) ─────────────────────
// ua_public: subscriber p256dh (65B), auth: subscriber auth secret (16B).
// opts (test-only) may inject { salt (16B), asPrivateJwk, asPublic (65B) };
// in production the ephemeral key pair and salt are random.
export async function encryptContent(payloadBytes, uaPublic, auth, opts = {}) {
  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16));

  let asPrivateKey, asPublic;
  if (opts.asPrivateJwk && opts.asPublic) {
    asPublic = opts.asPublic;
    const { x, y } = pointToXY(asPublic);
    asPrivateKey = await crypto.subtle.importKey(
      "jwk", { kty: "EC", crv: "P-256", x, y, d: opts.asPrivateJwk.d, ext: true },
      { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  } else {
    const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    asPrivateKey = kp.privateKey;
    asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  }

  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asPrivateKey, 256));

  // Combine step (auth secret) → IKM.
  const keyInfo = concat(enc.encode("WebPush: info"), new Uint8Array([0]), uaPublic, asPublic);
  const ikm = await hkdf(auth, ecdhSecret, keyInfo, 32);

  // Content key + nonce.
  const cek = await hkdf(salt, ikm, concat(enc.encode("Content-Encoding: aes128gcm"), new Uint8Array([0])), 16);
  const nonce = await hkdf(salt, ikm, concat(enc.encode("Content-Encoding: nonce"), new Uint8Array([0])), 12);

  // Single record: plaintext || 0x02 delimiter, AES-128-GCM (tag appended).
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const record = concat(payloadBytes, new Uint8Array([2]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aesKey, record));

  // Header: salt(16) || rs(uint32 = 4096) || idlen(1 = 65) || keyid(as_public 65).
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = 65;
  header.set(asPublic, 21);

  return concat(header, ciphertext);
}

// ── VAPID (RFC 8292) ─────────────────────────────────────────────────────────
async function vapidJwt(audience, env) {
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = bytesToB64url(enc.encode(JSON.stringify({
    aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT,
  })));
  const signingInput = `${header}.${claims}`;

  const pub = b64urlToBytes(env.VAPID_PUBLIC_KEY);
  const { x, y } = pointToXY(pub);
  const key = await crypto.subtle.importKey(
    "jwk", { kty: "EC", crv: "P-256", x, y, d: env.VAPID_PRIVATE_KEY, ext: true },
    { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(signingInput)));
  return `${signingInput}.${bytesToB64url(sig)}`; // WebCrypto ECDSA sig is already r||s
}

// ── Send one push message ────────────────────────────────────────────────────
// Returns { ok: true } on accept, { gone: true } for a dead subscription
// (404/410), or { error } otherwise. Never throws for HTTP-level failures.
export async function sendPush(subscription, payloadObj, env) {
  const endpoint = subscription.endpoint;
  const audience = new URL(endpoint).origin;
  const jwt = await vapidJwt(audience, env);

  const body = await encryptContent(
    enc.encode(JSON.stringify(payloadObj)),
    b64urlToBytes(subscription.p256dh),
    b64urlToBytes(subscription.auth),
  );

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      TTL: "60",
      Urgency: "high",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
    },
    body,
  });
  if (res.status === 201 || res.status === 200 || res.status === 202) return { ok: true };
  if (res.status === 404 || res.status === 410) return { gone: true };
  return { error: `push ${res.status}` };
}
