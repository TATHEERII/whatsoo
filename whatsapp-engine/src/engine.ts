import type { Client, MessageSendOptions } from "whatsapp-web.js";
import { EventEmitter } from "node:events";
import fs from "fs";
import path from "path";

export interface ObfuscationOptions {
  enabled?: boolean;
  dotReplaceRatio?: number;
  invisibleCharDensity?: number;
  preserveLineBreaks?: boolean;
  preservePunctuation?: boolean;
  trailingSpacesCount?: number;
}

export const defaultObfuscationOptions: Required<ObfuscationOptions> = {
  enabled: true,
  dotReplaceRatio: 0.3,
  invisibleCharDensity: 0.1,
  preserveLineBreaks: true,
  preservePunctuation: true,
  trailingSpacesCount: 3,
};

const INVISIBLE_CHARS = ["\u200B", "\u200C", "\u200D", "\u2060", "\uFEFF"];
const PUNCTUATION_REGEX = /[!"#$%&'()*+,\-.\/:;<=>?@[\\\]^_`{|}~]/g;
const WHITESPACE_REGEX = /\s/g;

export function obfuscateText(
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

export function obfuscateLine(
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

export class WhatsAppEngine extends EventEmitter {
  private client: Client | null = null;
  private ready = false;
  private lastQr: string | null = null;
  private obfuscationOptions: Required<ObfuscationOptions>;
  private wapi: typeof import("whatsapp-web.js") | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    super();
    this.obfuscationOptions = { ...defaultObfuscationOptions };
  }

  private async loadLib() {
    if (!this.wapi) {
      this.wapi = await import("whatsapp-web.js");
    }
    return this.wapi;
  }

  private getSessionDir(): string {
    if (process.env.SESSION_DIR) {
      return process.env.SESSION_DIR;
    }
    return path.resolve(process.cwd(), ".wwebjs_auth");
  }

  private async ensureSessionDir(): Promise<string> {
    const baseDir = this.getSessionDir();
    const sessionDir = path.join(baseDir, "session");
    fs.mkdirSync(sessionDir, { recursive: true });
    return baseDir;
  }

  async initialize(puppeteerOptions?: object): Promise<void> {
    if (this.client && this.ready) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.client && !this.ready) {
      try {
        await this.client.destroy();
      } catch {
        /* ignore */
      }
      this.client = null;
      this.lastQr = null;
    }

    this.ready = false;
    this.lastQr = null;

    this.initPromise = (async () => {
      const lib = await this.loadLib();

      const defaultPuppeteerOptions: Record<string, unknown> = {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-extensions",
        ],
      };

      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        defaultPuppeteerOptions.executablePath =
          process.env.PUPPETEER_EXECUTABLE_PATH;
      }

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
        this.emit("qr", qr);
      });

      this.client.on("ready", () => {
        this.ready = true;
        this.lastQr = null;
        this.emit("ready");
      });

      this.client.on("disconnected", (reason: string) => {
        this.ready = false;
        this.emit("disconnected", reason);
      });

      this.client.on("auth_failure", () => {
        this.ready = false;
        this.emit("auth_failure");
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

  onQR(cb: (qr: string) => void): void {
    this.on("qr", cb);
  }

  onReady(cb: () => void): void {
    this.on("ready", cb);
  }

  onDisconnected(cb: (reason: string) => void): void {
    this.on("disconnected", cb);
  }

  onAuthFailure(cb: () => void): void {
    this.on("auth_failure", cb);
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

    const isReady = this.ready;
    const qr = isReady ? null : this.lastQr;

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

      if (wid.user) {
        const phoneMatch = wid.user.match(/^\+?\d+$/);
        if (phoneMatch) {
          return wid.user.replace(/^\+/, "");
        }
      }

      if (wid._serialized) {
        const atIndex = wid._serialized.indexOf("@");
        if (atIndex > 0) {
          const phonePart = wid._serialized.substring(0, atIndex);
          const phoneMatch = phonePart.match(/^\+?\d+$/);
          if (phoneMatch) {
            return phonePart.replace(/^\+/, "");
          }
        }
      }

      try {
        const serialized = wid._serialized;
        if (serialized) {
          const formatted = await this.client.getFormattedNumber(serialized);
          if (formatted) {
            const digits = formatted.replace(/\D/g, "");
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
      return { error: err instanceof Error ? err.message : "Unknown error" };
    }
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
    } else {
      this.ready = false;
      this.lastQr = null;
      try {
        await this.client.logout();
        console.log("[engine] Logged out");
      } catch (err) {
        console.error("[engine] Logout failed:", err);
      }

      try {
        await this.client.destroy();
      } catch {
        /* ignore */
      }
      this.client = null;
    }

    if (clearSession) {
      await this.clearSession();
    }
  }

  private async clearSession(): Promise<void> {
    const sessionPath = this.getSessionDir();
    try {
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log("[engine] Session cleared successfully");
      }
    } catch (err) {
      console.error("[engine] Failed to clear session:", err);
    }
  }
}
