/*
 * RFC 8291 Appendix A self-test for functions/push/webpush.js.
 * Runs the content encryption on the RFC's fixed keys/salt and asserts the
 * output equals the RFC's header + ciphertext, byte for byte. If this fails,
 * the crypto is wrong — do NOT ship push. Run: node scripts/webpush-selftest.mjs
 */
import { encryptContent, b64urlToBytes, bytesToB64url } from "../functions/push/webpush.js";

// Verbatim values from RFC 8291 Appendix A.
const PLAINTEXT = "V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24"; // "When I grow up, I want to be a watermelon"
const AUTH = "BTBZMqHH6r4Tts7J_aSIgg";
const UA_PUBLIC = "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
const AS_PUBLIC = "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
const AS_PRIVATE = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
const SALT = "DGv6ra1nlYgDCS1FRnbzlw";
// Header (86 octets) and ciphertext, given separately in Appendix A / Section 5.
const HEADER = "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
const CIPHERTEXT = "8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ";

function eqBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function concat(a, b) { const o = new Uint8Array(a.length + b.length); o.set(a, 0); o.set(b, a.length); return o; }

const out = await encryptContent(
  b64urlToBytes(PLAINTEXT),
  b64urlToBytes(UA_PUBLIC),
  b64urlToBytes(AUTH),
  { salt: b64urlToBytes(SALT), asPrivateJwk: { d: AS_PRIVATE }, asPublic: b64urlToBytes(AS_PUBLIC) },
);

const expected = concat(b64urlToBytes(HEADER), b64urlToBytes(CIPHERTEXT));

if (eqBytes(out, expected)) {
  console.log("OK, vector RFC 8291 identic");
  process.exit(0);
} else {
  console.error("EȘEC: rezultatul nu se potrivește cu vectorul RFC 8291.");
  console.error("  obținut : " + bytesToB64url(out));
  console.error("  așteptat: " + bytesToB64url(expected));
  process.exit(1);
}
