export class Client {
  on(): this {
    return this;
  }
  initialize(): Promise<void> {
    return Promise.resolve();
  }
  destroy(): Promise<void> {
    return Promise.resolve();
  }
  getState(): Promise<string> {
    return Promise.resolve("CONNECTED");
  }
  sendMessage(): Promise<unknown> {
    return Promise.resolve();
  }
  logout(): Promise<void> {
    return Promise.resolve();
  }
  getFormattedNumber(): Promise<string> {
    return Promise.resolve("+1234567890");
  }
  info: unknown = null;
}

export class LocalAuth {
  constructor(opts?: Record<string, unknown>) {}
}

export class MessageMedia {
  static fromFilePath(path: string): MessageMedia {
    return new MessageMedia();
  }
}

export interface MessageSendOptions {
  caption?: string;
  sendMediaAsDocument?: boolean;
}

export type SessionData = unknown;
export type AcknowledgmentNumeric = number;
export type MessageTypes = unknown;
