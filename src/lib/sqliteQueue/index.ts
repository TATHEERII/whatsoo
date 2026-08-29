import prisma from "@/lib/prisma";
import { getWhatsAppEngine } from "@/lib/whatsapp/engine";

export type DelayType = "fixed" | "random" | "progressive";

export interface EnqueueCampaignInput {
  campaignId: string;
  delayType?: DelayType;
  delayValue?: number;
  maxAttempts?: number;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

const POLL_INTERVAL_MS = 30_000;

function calculateDelay(
  delayType: DelayType,
  delayValue: number,
  contactIndex: number
): number {
  switch (delayType) {
    case "fixed":
      return delayValue;
    case "random":
      return Math.floor(Math.random() * delayValue);
    case "progressive":
      return delayValue * (contactIndex + 1);
    default:
      return 0;
  }
}

class SqliteQueueService {
  private static instance: SqliteQueueService | null = null;
  private schedulerInterval: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;

  private constructor() {}

  static getInstance(): SqliteQueueService {
    if (!SqliteQueueService.instance) {
      SqliteQueueService.instance = new SqliteQueueService();
    }
    return SqliteQueueService.instance;
  }

  async enqueueCampaign({
    campaignId,
    delayType,
    delayValue,
    maxAttempts,
  }: EnqueueCampaignInput): Promise<number> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        contactList: {
          include: {
            contacts: {
              select: { id: true, name: true, phoneNumber: true },
            },
          },
        },
      },
    });

    if (!campaign || !campaign.contactList?.contacts.length) {
      throw new Error("Campaign or contacts not found");
    }

    const resolvedDelayType = delayType ?? (campaign.delayType as DelayType) ?? "fixed";
    const resolvedDelayValue = delayValue ?? campaign.delayValue ?? 5000;
    const resolvedMaxAttempts = maxAttempts ?? campaign.maxAttempts ?? 3;

    const contacts = campaign.contactList.contacts;
    const now = Date.now();

    const data = contacts.map((contact, index) => {
      const delay = calculateDelay(resolvedDelayType, resolvedDelayValue, index);
      const scheduledAt = new Date(now + delay);

      return {
        campaignId,
        contactIndex: index,
        status: "pending",
        attempts: 0,
        maxAttempts: resolvedMaxAttempts,
        scheduledAt,
        recipient: contact.phoneNumber,
        recipientName: contact.name,
        recipientId: contact.id,
        templateId: campaign.templateId,
        templateName: campaign.templateName,
        userId: campaign.userId,
      };
    });

    const result = await prisma.jobQueue.createMany({ data });

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "running",
        delayType: resolvedDelayType,
        delayValue: resolvedDelayValue,
        maxAttempts: resolvedMaxAttempts,
      },
    });

    return result.count;
  }

  async processPendingJobs(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const now = new Date();

      const jobs = await prisma.jobQueue.findMany({
        where: {
          status: "pending",
          scheduledAt: { lte: now },
        },
        orderBy: { scheduledAt: "asc" },
        take: 10,
      });

      for (const job of jobs) {
        await this.processJob(job);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processJob(job: {
    id: string;
    campaignId: string;
    recipient: string | null;
    recipientName: string | null;
    recipientId: string | null;
    templateId: string | null;
    templateName: string | null;
    attempts: number;
    maxAttempts: number;
  }): Promise<void> {
    const locked = await prisma.jobQueue.updateMany({
      where: { id: job.id, status: "pending" },
      data: { status: "processing", processedAt: new Date() },
    });

    if (locked.count === 0) return;

    const engine = getWhatsAppEngine();

    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: job.campaignId },
      });

      if (!campaign || !job.recipient) {
        await prisma.jobQueue.update({
          where: { id: job.id },
          data: {
            status: "failed",
            error: "Campaign or recipient not found",
            completedAt: new Date(),
          },
        });
        return;
      }

      const messageContent =
        campaign.message ||
        job.templateName ||
        campaign.description ||
        campaign.name;

      await engine.sendText(job.recipient, messageContent);

      await prisma.jobQueue.update({
        where: { id: job.id },
        data: { status: "completed", completedAt: new Date() },
      });

      await prisma.campaignLog.create({
        data: {
          campaignId: job.campaignId,
          recipient: job.recipient,
          status: "sent",
          sentAt: new Date(),
        },
      });

      await this.checkCampaignCompletion(job.campaignId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      const newAttempts = job.attempts + 1;

      if (newAttempts >= job.maxAttempts) {
        await prisma.jobQueue.update({
          where: { id: job.id },
          data: {
            status: "failed",
            attempts: newAttempts,
            error: errorMessage,
            completedAt: new Date(),
          },
        });

        await prisma.campaignLog.create({
          data: {
            campaignId: job.campaignId,
            recipient: job.recipient ?? "",
            status: "failed",
            error: errorMessage,
            sentAt: new Date(),
          },
        });
      } else {
        const backoffDelay = Math.pow(2, newAttempts) * 1000;
        await prisma.jobQueue.update({
          where: { id: job.id },
          data: {
            status: "pending",
            attempts: newAttempts,
            error: errorMessage,
            scheduledAt: new Date(Date.now() + backoffDelay),
          },
        });
      }

      await this.checkCampaignCompletion(job.campaignId);
    }
  }

  async checkCampaignCompletion(campaignId: string): Promise<boolean> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        contactList: {
          include: {
            contacts: { select: { id: true } },
          },
        },
      },
    });

    if (!campaign) return false;

    const totalContacts = campaign.contactList?.contacts.length ?? 0;
    if (totalContacts === 0) return false;

    const completedCount = await prisma.jobQueue.count({
      where: {
        campaignId,
        status: { in: ["completed", "failed"] },
      },
    });

    if (completedCount >= totalContacts) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "completed" },
      });
      return true;
    }

    return false;
  }

  startScheduler(): void {
    if (this.schedulerInterval) return;

    this.schedulerInterval = setInterval(() => {
      this.processPendingJobs().catch((err) => {
        console.error("[SQLiteQueue] Error processing jobs:", err);
      });
    }, POLL_INTERVAL_MS);

    console.log(
      `[SQLiteQueue] Scheduler started (polling every ${POLL_INTERVAL_MS / 1000}s)`
    );
  }

  stopScheduler(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      console.log("[SQLiteQueue] Scheduler stopped");
    }
  }

  async getQueueStats(campaignId?: string): Promise<QueueStats> {
    const where = campaignId ? { campaignId } : {};

    const [pending, processing, completed, failed, total] =
      await Promise.all([
        prisma.jobQueue.count({ where: { ...where, status: "pending" } }),
        prisma.jobQueue.count({ where: { ...where, status: "processing" } }),
        prisma.jobQueue.count({ where: { ...where, status: "completed" } }),
        prisma.jobQueue.count({ where: { ...where, status: "failed" } }),
        prisma.jobQueue.count({ where }),
      ]);

    return { pending, processing, completed, failed, total };
  }
}

export const getSqliteQueueService = (): SqliteQueueService =>
  SqliteQueueService.getInstance();
export { calculateDelay };
export default SqliteQueueService;