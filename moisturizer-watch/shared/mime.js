/* mime.js - RFC-compliant MIME message builder (pure JS, no sockets, testable in Node). */

const CRLF = "\r\n";

export function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  const CHUNK = 0x4000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export function wrapBase64(b64, width = 76) {
  const out = [];
  for (let i = 0; i < b64.length; i += width) out.push(b64.slice(i, i + width));
  return out.join(CRLF);
}

const NON_ASCII = /[^\x00-\x7F]/;
export function encodeWord(value) {
  const s = String(value);
  if (!NON_ASCII.test(s)) return s;
  return `=?utf-8?B?${b64encode(s)}?=`;
}

function part(contentType, body, extraHeaders = "") {
  const encoded = wrapBase64(b64encode(body));
  return [
    `Content-Type: ${contentType}`,
    "Content-Transfer-Encoding: base64",
    ...(extraHeaders ? extraHeaders.split(CRLF).filter(Boolean) : []),
    "",
    encoded,
  ].join(CRLF);
}

export function buildMime({ from, to, subject, html, text }) {
  const boundary = `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const headers = [
    "MIME-Version: 1.0",
    `Subject: ${encodeWord(subject)}`,
    `From: ${from}`,
    `To: ${to}`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
  ].join(CRLF);

  return [
    headers,
    `--${boundary}`,
    part('text/plain; charset="utf-8"', text),
    `--${boundary}`,
    part('text/html; charset="utf-8"', html),
    `--${boundary}--`,
    "",
  ].join(CRLF);
}