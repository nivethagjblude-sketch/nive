/* smtp.js - minimal SMTP client over Cloudflare Worker sockets (TLS).

Port 465 = implicit TLS. Sends one message with Gmail's submission flow:
EHLO -> AUTH LOGIN -> MAIL FROM -> RCPT TO -> DATA -> QUIT.

Only used inside the Worker runtime (requires `cloudflare:sockets`).
Import and call buildMime() from mime.js; never import this from Node scripts.
*/

import { connect } from "cloudflare:sockets";

export class SmtpError extends Error {}

const enc = (s) => new TextEncoder().encode(s);

function withTimeout(promise, ms, label) {
  let t;
  const timer = new Promise((_, reject) => {
    t = setTimeout(() => reject(new SmtpError(`${label} timed out`)), ms);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(t));
}

class Session {
  constructor(socket) {
    this.socket = socket;
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
    this.buffer = "";
  }

  async _nextLine() {
    while (true) {
      const nl = this.buffer.indexOf("\n");
      if (nl !== -1) {
        const line = this.buffer.slice(0, nl).replace(/\r$/, "");
        this.buffer = this.buffer.slice(nl + 1);
        return line;
      }
      const { value, done } = await this.reader.read();
      if (done) throw new SmtpError("socket closed unexpectedly");
      this.buffer += new TextDecoder().decode(value);
    }
  }

  async expect(prefix) {
    for (let i = 0; i < 40; i++) {
      const line = await this._nextLine();
      const code3 = line.slice(0, 3);
      const last = code3 === prefix.slice(0, 3) && line.length <= 3 ? true
        : line.charAt(3) === " " && line.startsWith(prefix.slice(0, 3));
      if (line.startsWith(prefix)) return line;
      if (/^\d{3} /.test(line) && !line.startsWith(prefix)) {
        throw new SmtpError(`SMTP expected ${prefix}, got: ${line}`);
      }
      if (line.length < 3 && /^\d{3}[ -]/.test(line) && code3 !== prefix) {
        throw new SmtpError(`SMTP expected ${prefix}, got: ${line}`);
      }
    }
    throw new SmtpError(`SMTP did not return ${prefix}`);
  }

  async send(line) {
    await this.writer.write(enc(line + "\r\n"));
  }

  async close() {
    try { await this.writer.close(); } catch {}
    try { this.reader.releaseLock(); } catch {}
    try { this.socket.close(); } catch {}
  }
}

export async function sendSmtp({
  host, port, user, password, from, to, message, timeout = 30000,
}) {
  const socket = connect({ hostname: host, port, secureTransport: "on" });
  const session = new Session(socket);
  try {
    await withTimeout(session.expect("220"), timeout, "SMTP greeting");

    await session.send(`EHLO moisturizer-watch`);
    await withTimeout(session.expect("250"), timeout, "EHLO");

    await session.send("AUTH LOGIN");
    await withTimeout(session.expect("334"), timeout, "AUTH begin");
    await session.send(btoa(user));
    await withTimeout(session.expect("334"), timeout, "AUTH username");
    await session.send(btoa(password));
    await withTimeout(session.expect("235"), timeout, "AUTH complete");

    await session.send(`MAIL FROM:<${from}>`);
    await withTimeout(session.expect("250"), timeout, "MAIL FROM");
    await session.send(`RCPT TO:<${to}>`);
    await withTimeout(session.expect("250"), timeout, "RCPT TO");

    await session.send("DATA");
    await withTimeout(session.expect("354"), timeout, "DATA begin");
    await session.send(message.replace(/\r?\n/g, "\r\n") + "\r\n.");
    await withTimeout(session.expect("250"), timeout, "DATA end");

    await session.send("QUIT");
    return "ok";
  } catch (err) {
    await session.close().catch(() => {});
    if (err instanceof SmtpError) throw err;
    throw new SmtpError(String(err && err.message || err));
  }
}