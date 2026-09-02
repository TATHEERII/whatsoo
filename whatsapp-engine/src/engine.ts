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
  private lastError: string | null = null;
  private obfuscationOptions: Required<ObfuscationOptions>;
  private wapi: typeof import("whatsapp-web.js") | null = null;
  private initPromise: Promise<void> | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private maxReconnectAttempts = 5;
  private reconnectDelayMs = 5000;

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
    // LocalAuth expects dataPath to be the base directory; it creates its own
    // session subdirectories internally (e.g., "session-Name"). We only need
    // to ensure the base directory exists.
    fs.mkdirSync(baseDir, { recursive: true });
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
    this.lastError = null;

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
          clientId: "session", // Use a fixed session name for consistency
        }),
        puppeteer: puppeteerOptions ?? defaultPuppeteerOptions,
      });

      // Track connection state for debugging and monitoring
      let lastConnectionState: string | null = null;

      this.client.on("qr", (qr: string) => {
        this.ready = false;
        this.lastQr = qr;
        this.emit("qr", qr);
        console.log("[engine] QR code received, waiting for scan");
      });

      this.client.on("ready", () => {
        this.ready = true;
        this.lastQr = null;
        this.lastError = null;
        this.reconnectAttempts = 0; // Reset reconnect counter on successful connection
        this.emit("ready");
        console.log("[engine] Client is ready and connected");
      });

      this.client.on("disconnected", (reason: string) => {
        this.ready = false;
        console.log(`[engine] Client disconnected: ${reason}`);
        this.emit("disconnected", reason);

        // Attempt auto-reconnect unless disconnect was intentional
        // (intentional disconnects go through the disconnect() method which clears client)
        if (this.client && reason !== "RESET_FOR_RECONNECT") {
          this.attemptReconnect(reason);
        }
      });

      this.client.on("auth_failure", (msg: string) => {
        this.ready = false;
        this.lastError = msg;
        console.error(`[engine] Authentication failure: ${msg}`);
        this.emit("auth_failure", msg);
      });

      // Monitor connection state changes for debugging
      this.client.on("change_state", (state: any) => {
        const stateStr = typeof state === "string" ? state : String(state);
        if (lastConnectionState !== stateStr) {
          console.log(`[engine] Connection state changed: ${lastConnectionState} -> ${stateStr}`);
          lastConnectionState = stateStr;
        }
      });

      // Monitor loading screen changes (helpful for debugging connection issues)
      this.client.on("loading_screen", (processCode: number, message: string) => {
        console.log(`[engine] Loading screen: ${processCode} - ${message}`);
      });

      // Handle unexpected errors that might cause silent disconnects
      this.client.on("error", (err: Error) => {
        console.error("[engine] Client error:", err);
        this.lastError = err.message;
      });

      try {
        await this.client.initialize();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.lastError = message;
        console.error("[engine] initialize failed:", message);
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
    error: string | null;
  }> {
    if (!this.client) {
      if (this.lastError) {
        return { state: "UNLAUNCHED", ready: false, qr: null, phoneNumber: null, error: this.lastError };
      }
      return { state: "UNLAUNCHED", ready: false, qr: null, phoneNumber: null, error: null };
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
      error: this.lastError,
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
      // LocalAuth creates session subdirectories like "session-Number" under dataPath
      // Check if any session subdirectory exists in the base auth directory
      const entries = fs.readdirSync(baseDir, { withFileTypes: true });
      return entries.some(
        (entry) =>
          entry.isDirectory() &&
          (entry.name.startsWith("session-") || entry.name === "session")
      );
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

  private attemptReconnect(reason: string): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        `[engine] Max reconnect attempts (${this.maxReconnectAttempts}) reached, giving up. Last reason: ${reason}`
      );
      this.emit("reconnect_failed");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelayMs * this.reconnectAttempts;
    console.log(
      `[engine] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms. Reason: ${reason}`
    );

    this.emit("reconnect_attempt", this.reconnectAttempts, this.maxReconnectAttempts, delay);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.initialize().catch((err) => {
        console.error("[engine] Reconnect failed:", err);
      });
    }, delay);
  }

  async disconnect(clearSession: boolean = false): Promise<void> {
    // Clear any pending reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;

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
