import type { Client, MessageSendOptions } from "whatsapp-web.js";

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
  private static instance: WhatsAppEngine | null = null;

  private client: Client | null = null;
  private ready = false;
  private lastQr: string | null = null;
  private qrCallback: QRCallback | null = null;
  private readyCallback: ReadyCallback | null = null;
  private disconnectedCallback: DisconnectedCallback | null = null;
  private authFailureCallback: AuthFailureCallback | null = null;
  private obfuscationOptions: Required<ObfuscationOptions>;
  private wapi: typeof import("whatsapp-web.js") | null = null;

  private constructor() {
    this.obfuscationOptions = { ...defaultObfuscationOptions };
  }

  static getInstance(): WhatsAppEngine {
    if (!WhatsAppEngine.instance) {
      WhatsAppEngine.instance = new WhatsAppEngine();
    }
    return WhatsAppEngine.instance;
  }

  private async loadLib() {
    if (!this.wapi) {
      this.wapi = await import("whatsapp-web.js");
    }
    return this.wapi;
  }

  async initialize(puppeteerOptions?: object): Promise<void> {
    if (this.client) {
      return;
    }

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

    this.client = new lib.Client({
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
    }
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
  }> {
    if (!this.client) {
      return { state: "UNLAUNCHED", ready: false, qr: this.lastQr };
    }

    let state = "UNKNOWN";
    try {
      state = String(await this.client.getState());
    } catch {
      state = "UNKNOWN";
    }

    return {
      state,
      ready: this.ready,
      qr: this.ready ? null : this.lastQr,
    };
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
    const obfuscated = this.obfuscateMessage(text);
    await this.client.sendMessage(to, obfuscated);
  }

  async sendImage(to: string, filePath: string, caption?: string): Promise<void> {
    if (!this.client || !this.wapi) {
      throw new Error("WhatsApp client is not initialized");
    }
    const media = this.wapi.MessageMedia.fromFilePath(filePath);
    const options: MessageSendOptions = {};
    if (caption) {
      options.caption = this.obfuscateMessage(caption);
    }
    await this.client.sendMessage(to, media, options);
  }

  async sendVideo(to: string, filePath: string, caption?: string): Promise<void> {
    if (!this.client || !this.wapi) {
      throw new Error("WhatsApp client is not initialized");
    }
    const media = this.wapi.MessageMedia.fromFilePath(filePath);
    const options: MessageSendOptions = {
      sendMediaAsDocument: false,
    };
    if (caption) {
      options.caption = this.obfuscateMessage(caption);
    }
    await this.client.sendMessage(to, media, options);
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

  async disconnect(): Promise<void> {
    if (!this.client) {
      this.ready = false;
      this.lastQr = null;
      WhatsAppEngine.instance = null;
      return;
    }
    this.ready = false;
    this.lastQr = null;
    try {
      await this.client.destroy();
    } finally {
      this.client = null;
      WhatsAppEngine.instance = null;
    }
  }
}

export const getWhatsAppEngine = (): WhatsAppEngine =>
  WhatsAppEngine.getInstance();
export default WhatsAppEngine;
