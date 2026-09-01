import type { Client, MessageSendOptions } from "whatsapp-web.js";
import fs from "fs";
import path from "path";

const SESSION_DIR = path.resolve(process.cwd(), ".wwebjs_auth", "session");

export interface ObfuscationOptions {
  enabled?: boolean;
  dotReplaceRatio?: number;
  invisibleCharDensity?: number;
  preserveLineBreaks?: boolean;
  preservePunctuation?: boolean;
  trailingSpacesCount?: number;
}

const defaultObfuscationOptions: Required<ObfuscationOptions> = {
  enabled: true,
  dotReplaceRatio: 0.3,
  invisibleCharDensity: 0.1,
  preserveLineBreaks: true,
  preservePunctuation: true,
  trailingSpacesCount: 3,
};

const INVISIBLE_CHARS = ["\u200B", "\u200C", "\u200D", "\u2060", "\uFEFF"];
const PUNCTUATION_REGEX = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_{|}~]/g;
const WHITESPACE_REGEX = /\s/g;

function obfuscateText(
  text: string,
  options: Required<ObfuscationOptions>
): string {
  if (!options.enabled || text.trim().length === 0) {
    return text;
  }

  let result = text;

  if (options.preserveLineBreaks) {
    const lines = result.split("\n");
    result = lines.map((line) => obfuscateLine(line, options)).join("\n");
  } else {
    result = obfuscateLine(result, options);
  }

  if (options.trailingSpacesCount > 0 && !options.preserveLineBreaks) {
    result = result + " ".repeat(options.trailingSpacesCount);
  }

  return result;
}

function obfuscateLine(
  line: string,
  options: Required<ObfuscationOptions>
): string {
  if (line.trim().length === 0) {
    return line;
  }

  let result = line;

  if (options.invisibleCharDensity > 0) {
    const chars = result.split("");
    for (let i = 0; i < chars.length; i++) {
      if (Math.random() < options.invisibleCharDensity) {
        const invisible =
          INVISIBLE_CHARS[Math.floor(Math.random() * INVISIBLE_CHARS.length)];
        chars[i] = chars[i] + invisible;
      }
    }
    result = chars.join("");
  }

  if (options.dotReplaceRatio > 0) {
    result = result
      .split("")
      .map((char) => {
        if (options.preservePunctuation && PUNCTUATION_REGEX.test(char)) {
          return char;
        }
        if (WHITESPACE_REGEX.test(char)) {
          return char;
        }
        if (Math.random() < options.dotReplaceRatio) {
          return "\u2022";
        }
        return char;
      })
      .join("");
  }

  return result;
}

type QRCallback = (qr: string) => void;
type ReadyCallback = () => void;
type DisconnectedCallback = (reason: string) => void;
type AuthFailureCallback = () => void;

class WhatsAppEngine {
  private client: Client | null = null;
  private ready = false;
  private lastQr: string | null = null;
  private qrCallback: QRCallback | null = null;
  private readyCallback: ReadyCallback | null = null;
  private disconnectedCallback: DisconnectedCallback | null = null;
  private authFailureCallback: AuthFailureCallback | null = null;
  private obfuscationOptions: Required<ObfuscationOptions>;
  private wapi: typeof import("whatsapp-web.js") | null = null;
  private initPromise: Promise<void> | null = null;

  private constructor() {
    this.obfuscationOptions = { ...defaultObfuscationOptions };
  }

  static getInstance(): WhatsAppEngine {
    const g = globalThis as unknown as { __whatsAppEngine?: WhatsAppEngine };
    if (!g.__whatsAppEngine) {
      g.__whatsAppEngine = new WhatsAppEngine();
    }
    return g.__whatsAppEngine;
  }

  private async loadLib() {
    if (!this.wapi) {
      this.wapi = await import("whatsapp-web.js");
    }
    return this.wapi;
  }

  private async ensureSessionDir(): Promise<string> {
    const baseDir = path.resolve(process.cwd(), ".wwebjs_auth");
    const sessionDir = path.join(baseDir, "session");

    try {
      fs.mkdirSync(sessionDir, { recursive: true });
      return baseDir;
    } catch {
      const fallbackDir = path.resolve("/tmp", ".wwebjs_auth");
      const fallbackSessionDir = path.join(fallbackDir, "session");
      fs.mkdirSync(fallbackSessionDir, { recursive: true });
      return fallbackDir;
    }
  }

   async initialize(puppeteerOptions?: object): Promise<void> {
    // If already initialized and ready, nothing to do
    if (this.client && this.ready) {
      return;
    }

    // If a previous initialization is in progress, wait for it
    if (this.initPromise) {
      return this.initPromise;
    }

    // If client exists but is not ready (broken/stale state), destroy it
    // and start fresh. This handles cases where the WhatsApp client was
    // created but the underlying browser session is no longer valid.
    if (this.client && !this.ready) {
      try {
        await this.client.destroy();
      } catch {
        /* ignore */
      }
      this.client = null;
      this.lastQr = null;
    }

    // Reset state for new connection attempt
    this.ready = false;
    this.lastQr = null;

    this.initPromise = (async () => {
      const lib = await this.loadLib();

      const defaultPuppeteerOptions = {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-extensions",
        ],
      };

      const dataPath = await this.ensureSessionDir();

      this.client = new lib.Client({
        authStrategy: new lib.LocalAuth({
          dataPath: dataPath,
        }),
        puppeteer: puppeteerOptions ?? defaultPuppeteerOptions,
      });

      this.client.on("qr", (qr: string) => {
        this.ready = false;
        this.lastQr = qr;
        if (this.qrCallback) {
          this.qrCallback(qr);
        }
      });

      this.client.on("ready", () => {
        this.ready = true;
        this.lastQr = null;
        if (this.readyCallback) {
          this.readyCallback();
        }
      });

      this.client.on("disconnected", (reason: string) => {
        this.ready = false;
        if (this.disconnectedCallback) {
          this.disconnectedCallback(reason);
        }
      });

      this.client.on("auth_failure", () => {
        this.ready = false;
        if (this.authFailureCallback) {
          this.authFailureCallback();
        }
      });

      try {
        await this.client.initialize();
      } catch (err) {
        try {
          await this.client?.destroy();
        } catch {
          /* ignore */
        }
        this.client = null;
        this.ready = false;
        this.lastQr = null;
        throw err;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  onQR(callback: QRCallback): void {
    this.qrCallback = callback;
  }

  onReady(callback: ReadyCallback): void {
    this.readyCallback = callback;
  }

  onDisconnected(callback: DisconnectedCallback): void {
    this.disconnectedCallback = callback;
  }

  onAuthFailure(callback: AuthFailureCallback): void {
    this.authFailureCallback = callback;
  }

  async getStatus(): Promise<{
    state: string;
    ready: boolean;
    qr: string | null;
    phoneNumber: string | null;
  }> {
    if (!this.client) {
      return { state: "UNLAUNCHED", ready: false, qr: this.lastQr, phoneNumber: null };
    }

    let state = "UNKNOWN";
    try {
      state = String(await this.client.getState());
    } catch {
      if (this.initPromise) {
        state = "INITIALIZING";
      } else {
        state = "UNKNOWN";
      }
    }

    // Use a single snapshot of ready state to avoid race conditions
    const isReady = this.ready;
    const qr = isReady ? null : this.lastQr;

    // Debug logging
    console.log(`[WhatsApp getStatus] state=${state}, isReady=${isReady}, hasQr=${!!qr}, lastQr=${!!this.lastQr}`);

    return {
      state,
      ready: isReady,
      qr,
      phoneNumber: isReady ? await this.getPhoneNumber() : null,
    };
  }

  async getPhoneNumber(): Promise<string | null> {
    if (!this.client) return null;
    try {
      const info = this.client.info;
      if (!info) return null;

      const wid = info.wid || info.me;
      if (!wid) return null;

      // Extract phone number from wid.user if it looks like a phone number
      if (wid.user) {
        // Check if it's a phone number (numeric, possibly with + prefix)
        const phoneMatch = wid.user.match(/^\+?\d+$/);
        if (phoneMatch) {
          return wid.user.replace(/^\+/, '');
        }
      }

      // Fallback: parse from _serialized (format: "phone@server")
      if (wid._serialized) {
        const atIndex = wid._serialized.indexOf('@');
        if (atIndex > 0) {
          const phonePart = wid._serialized.substring(0, atIndex);
          // Verify it looks like a phone number
          const phoneMatch = phonePart.match(/^\+?\d+$/);
          if (phoneMatch) {
            return phonePart.replace(/^\+/, '');
          }
        }
      }

      // Additional fallback: try to get formatted number from the client
      try {
        const serialized = wid._serialized;
        if (serialized) {
          const formatted = await this.client.getFormattedNumber(serialized);
          if (formatted) {
            // Extract digits from formatted number
            const digits = formatted.replace(/\D/g, '');
            if (digits.length >= 10) {
              return digits;
            }
          }
        }
      } catch {
        // Ignore errors from getFormattedNumber
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Debug method to inspect client info for troubleshooting phone number extraction.
   * Remove after fixing.
   */
  debugClientInfo(): Record<string, unknown> | null {
    if (!this.client) return null;
    try {
      const info = this.client.info;
      if (!info) return null;

      const wid = info.wid || info.me;
      return {
        wid,
        hasInfo: !!info,
        pushname: info.pushname,
        platform: info.platform,
        phoneInfo: info.phone,
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  private getSessionDir(): string {
    const baseDir = path.resolve(process.cwd(), ".wwebjs_auth");
    const sessionDir = path.join(baseDir, "session");
    if (fs.existsSync(sessionDir)) {
      return baseDir;
    }
    const fallbackDir = path.resolve("/tmp", ".wwebjs_auth");
    const fallbackSessionDir = path.join(fallbackDir, "session");
    if (fs.existsSync(fallbackSessionDir)) {
      return fallbackDir;
    }
    return baseDir;
  }

  sessionExists(): boolean {
    try {
      const baseDir = this.getSessionDir();
      return fs.existsSync(path.join(baseDir, "session"));
    } catch {
      return false;
    }
  }

  setObfuscationOptions(options: ObfuscationOptions): void {
    this.obfuscationOptions = { ...this.obfuscationOptions, ...options };
  }

  obfuscateMessage(message: string): string {
    return obfuscateText(message, this.obfuscationOptions);
  }

  async sendText(to: string, text: string): Promise<void> {
    if (!this.client) {
      throw new Error("WhatsApp client is not initialized");
    }
    if (!this.ready) {
      throw new Error("WhatsApp client is not ready yet");
    }

    const chatId = to.includes("@")
      ? to
      : `${to.replace(/[\+\s\-]/g, "")}@s.whatsapp.net`;

    const obfuscated = this.obfuscateMessage(text);
    await this.client.sendMessage(chatId, obfuscated);
  }

  async sendImage(to: string, filePath: string, caption?: string): Promise<void> {
    if (!this.client) {
      throw new Error("WhatsApp client is not initialized");
    }
    if (!this.ready) {
      throw new Error("WhatsApp client is not ready yet");
    }
    if (!this.wapi) {
      throw new Error("WhatsApp client is not initialized");
    }
    const chatId = to.includes("@")
      ? to
      : `${to.replace(/[\+\s\-]/g, "")}@s.whatsapp.net`;
    const media = this.wapi.MessageMedia.fromFilePath(filePath);
    const options: MessageSendOptions = {};
    if (caption) {
      options.caption = this.obfuscateMessage(caption);
    }
    await this.client.sendMessage(chatId, media, options);
  }

  async sendVideo(to: string, filePath: string, caption?: string): Promise<void> {
    if (!this.client) {
      throw new Error("WhatsApp client is not initialized");
    }
    if (!this.ready) {
      throw new Error("WhatsApp client is not ready yet");
    }
    if (!this.wapi) {
      throw new Error("WhatsApp client is not initialized");
    }
    const chatId = to.includes("@")
      ? to
      : `${to.replace(/[\+\s\-]/g, "")}@s.whatsapp.net`;
    const media = this.wapi.MessageMedia.fromFilePath(filePath);
    const options: MessageSendOptions = {
      sendMediaAsDocument: false,
    };
    if (caption) {
      options.caption = this.obfuscateMessage(caption);
    }
    await this.client.sendMessage(chatId, media, options);
  }

  async sendCombined(
    to: string,
    filePath: string,
    text: string,
    mediaType: "image" | "video"
  ): Promise<void> {
    if (mediaType === "image") {
      await this.sendImage(to, filePath, text);
    } else if (mediaType === "video") {
      await this.sendVideo(to, filePath, text);
    } else {
      await this.sendText(to, text);
    }
  }

  async disconnect(clearSession: boolean = false): Promise<void> {
    const g = globalThis as unknown as { __whatsAppEngine?: WhatsAppEngine };

    // Wait for any in-progress initialization to settle before disconnecting
    if (this.initPromise) {
      try {
        await this.initPromise;
      } catch {
        /* initialization failed, proceed with cleanup */
      }
    }

    if (!this.client) {
      this.ready = false;
      this.lastQr = null;
      g.__whatsAppEngine = undefined;
    } else {
      this.ready = false;
      this.lastQr = null;
      try {
        await this.client.logout();
        console.log("[WhatsApp] Logged out");
      } catch (err) {
        console.error("[WhatsApp] Logout failed:", err);
      }

      // Always destroy the client after disconnect so the next initialize()
      // creates a fresh client. The old client may be in a logged-out or
      // broken state that would prevent proper reconnection.
      try {
        await this.client.destroy();
      } catch {
        /* ignore */
      }
      this.client = null;
      g.__whatsAppEngine = undefined;
    }

    // When user explicitly disconnects, clear the on-disk session so the
    // next connect shows a QR code to re-scan (force re-authentication).
    if (clearSession) {
      await this.clearSession();
    }
  }

  /**
   * Deletes the on-disk WhatsApp session directory so the next connect
   * requires scanning a new QR code.
   */
  private async clearSession(): Promise<void> {
    const sessionPath = this.getSessionDir();
    try {
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log("[WhatsApp] Session cleared successfully");
      }
    } catch (err) {
      console.error("[WhatsApp] Failed to clear session:", err);
    }
  }
}

export const getWhatsAppEngine = (): WhatsAppEngine =>
  WhatsAppEngine.getInstance();
export default WhatsAppEngine;
