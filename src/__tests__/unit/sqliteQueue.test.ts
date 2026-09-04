import { getSqliteQueueService } from "@/lib/sqliteQueue";
import { createMockEngineClient } from "../utils/mockEngineClient";
import { mockSendResponse } from "../utils/mockEngineClient";
import { mockPrisma } from "../utils/mockPrisma";

const mockEngine = createMockEngineClient();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: require("../utils/mockPrisma").mockPrisma,
}));

jest.mock("@/lib/whatsapp/engine-client", () => ({
  getEngineClient: jest.fn(() => mockEngine),
  EngineClientError: class EngineClientError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.name = "EngineClientError";
      this.status = status;
    }
  },
}));

describe("SQLiteQueueService", () => {
  let queue: ReturnType<typeof getSqliteQueueService>;

  beforeEach(() => {
    jest.clearAllMocks();
    queue = getSqliteQueueService();
    (queue as any).isProcessing = false;
    if ((queue as any).schedulerInterval) {
      clearInterval((queue as any).schedulerInterval);
      (queue as any).schedulerInterval = null;
    }
    const resetMocks = (obj: any) => {
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (val && val._isMockFunction) {
          val.mockReset();
        } else if (val && typeof val === "object" && !(val instanceof Date)) {
          resetMocks(val);
        }
      }
    };
    resetMocks(mockPrisma);
    resetMocks(mockEngine);
  });

  describe("enqueueCampaign", () => {
    it("should throw when campaign is not found", async () => {
      mockPrisma.campaign.findUnique.mockResolvedValueOnce(null);

      await expect(queue.enqueueCampaign({ campaignId: "nonexistent" })).rejects.toThrow(
        "Campaign or contacts not found"
      );
    });

    it("should throw when campaign has no contact list", async () => {
      mockPrisma.campaign.findUnique.mockResolvedValueOnce({
        id: "camp_1",
        userId: "user_123",
        contactList: null,
      });

      await expect(queue.enqueueCampaign({ campaignId: "camp_1" })).rejects.toThrow(
        "Campaign or contacts not found"
      );
    });

    it("should throw when contact list is empty", async () => {
      mockPrisma.campaign.findUnique.mockResolvedValueOnce({
        id: "camp_1",
        userId: "user_123",
        contactList: { contacts: [] },
      });

      await expect(queue.enqueueCampaign({ campaignId: "camp_1" })).rejects.toThrow(
        "Campaign or contacts not found"
      );
    });

    it("should create jobs for all contacts with fixed delay", async () => {
      mockPrisma.campaign.findUnique.mockResolvedValueOnce({
        id: "camp_1",
        userId: "user_123",
        delayType: "fixed",
        delayValue: 5000,
        maxAttempts: 3,
        contactList: {
          contacts: [
            { id: "c1", name: "Alice", phoneNumber: "+111" },
            { id: "c2", name: "Bob", phoneNumber: "+222" },
            { id: "c3", name: "Charlie", phoneNumber: "+333" },
          ],
        },
      });
      mockPrisma.jobQueue.createMany.mockResolvedValueOnce({ count: 3 });
      mockPrisma.campaign.update.mockResolvedValueOnce({ id: "camp_1", status: "running" });

      const count = await queue.enqueueCampaign({ campaignId: "camp_1" });
      expect(count).toBe(3);
      expect(mockPrisma.jobQueue.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              campaignId: "camp_1",
              contactIndex: 0,
              status: "pending",
              attempts: 0,
              maxAttempts: 3,
              recipient: "+111",
              recipientName: "Alice",
              recipientId: "c1",
            }),
          ]),
        })
      );
    });

    it("should use provided delay params over campaign defaults", async () => {
      mockPrisma.campaign.findUnique.mockResolvedValueOnce({
        id: "camp_1",
        userId: "user_123",
        delayType: "fixed",
        delayValue: 5000,
        maxAttempts: 3,
        contactList: {
          contacts: [{ id: "c1", name: "Alice", phoneNumber: "+111" }],
        },
      });
      mockPrisma.jobQueue.createMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.campaign.update.mockResolvedValueOnce({});

      await queue.enqueueCampaign({
        campaignId: "camp_1",
        delayType: "progressive",
        delayValue: 1000,
        maxAttempts: 5,
      });

      expect(mockPrisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            delayType: "progressive",
            delayValue: 1000,
            maxAttempts: 5,
          }),
        })
      );
    });

    it("should set campaign status to running after enqueue", async () => {
      const contacts = Array.from({ length: 3 }, (_, i) => ({
        id: `c${i}`, name: `User${i}`, phoneNumber: `+${i}`,
      }));

      mockPrisma.campaign.findUnique.mockResolvedValueOnce({
        id: "camp_1",
        userId: "user_123",
        delayType: "fixed",
        delayValue: 5000,
        maxAttempts: 3,
        contactList: { contacts },
      });
      mockPrisma.jobQueue.createMany.mockResolvedValueOnce({ count: 3 });
      mockPrisma.campaign.update.mockResolvedValueOnce({});

      await queue.enqueueCampaign({ campaignId: "camp_1" });
      expect(mockPrisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "running" }),
        })
      );
    });

    it("should calculate different delays for progressive type", async () => {
      mockPrisma.campaign.findUnique.mockResolvedValueOnce({
        id: "camp_1",
        userId: "user_123",
        delayType: "progressive",
        delayValue: 5000,
        maxAttempts: 3,
        contactList: {
          contacts: [
            { id: "c1", name: "A", phoneNumber: "+1" },
            { id: "c2", name: "B", phoneNumber: "+2" },
            { id: "c3", name: "C", phoneNumber: "+3" },
          ],
        },
      });
      mockPrisma.jobQueue.createMany.mockResolvedValueOnce({ count: 3 });
      mockPrisma.campaign.update.mockResolvedValueOnce({});

      await queue.enqueueCampaign({ campaignId: "camp_1" });

      const createCall = mockPrisma.jobQueue.createMany.mock.calls[0][0] as {
        data: Array<{ scheduledAt: Date }>;
      };
      const delays = createCall.data.map((d) => new Date(d.scheduledAt!).getTime());
      expect(delays[1]).toBeGreaterThan(delays[0]);
      expect(delays[2]).toBeGreaterThan(delays[1]);
    });
  });

  describe("processPendingJobs", () => {
    it("should skip processing when already processing", async () => {
      (queue as any).isProcessing = true;

      await queue.processPendingJobs();
      expect(mockPrisma.jobQueue.findMany).not.toHaveBeenCalled();
    });

    it("should fetch pending jobs with scheduledAt <= now", async () => {
      mockPrisma.jobQueue.findMany.mockResolvedValueOnce([]);

      await queue.processPendingJobs();
      expect(mockPrisma.jobQueue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "pending",
            scheduledAt: { lte: expect.any(Date) },
          }),
          orderBy: { scheduledAt: "asc" },
          take: 10,
        })
      );
    });

    it("should process each pending job and send message", async () => {
      mockPrisma.jobQueue.findMany.mockResolvedValueOnce([
        {
          id: "job_1",
          campaignId: "camp_1",
          recipient: "+123",
          recipientName: null,
          recipientId: null,
          templateId: null,
          templateName: null,
          attempts: 0,
          maxAttempts: 3,
        },
      ]);

      mockPrisma.campaign.findUnique.mockResolvedValueOnce({
        id: "camp_1",
        message: "Hello!",
      });
      mockPrisma.jobQueue.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.jobQueue.update.mockResolvedValueOnce({});
      mockPrisma.campaignLog.create.mockResolvedValueOnce({});
      mockPrisma.jobQueue.count.mockResolvedValueOnce(1);
      mockPrisma.campaign.findUnique.mockResolvedValueOnce({
        id: "camp_1",
        contactList: { contacts: [{ id: "c1" }] },
      });
      mockPrisma.campaign.update.mockResolvedValueOnce({});

      mockEngine.send.mockResolvedValueOnce(mockSendResponse);

      await queue.processPendingJobs();

      expect(mockEngine.send).toHaveBeenCalledWith({ to: "+123", text: "Hello!" });
      expect(mockPrisma.jobQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "job_1" },
          data: expect.objectContaining({ status: "completed" }),
        })
      );
    });

    it("should mark job as failed when engine.send throws", async () => {
      mockPrisma.jobQueue.findMany.mockResolvedValueOnce([
        {
          id: "job_1",
          campaignId: "camp_1",
          recipient: "+123",
          recipientName: null,
          recipientId: null,
          templateId: null,
          templateName: null,
          attempts: 2,
          maxAttempts: 3,
        },
      ]);

      mockPrisma.campaign.findUnique.mockResolvedValueOnce({ id: "camp_1", message: "Hello!" });
      mockPrisma.jobQueue.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.campaignLog.create.mockResolvedValueOnce({});
      mockPrisma.jobQueue.count.mockResolvedValueOnce(1);
      mockPrisma.campaign.findUnique.mockResolvedValueOnce({
        id: "camp_1",
        contactList: { contacts: [{ id: "c1" }] },
      });
      mockPrisma.campaign.update.mockResolvedValueOnce({});

      mockEngine.send.mockRejectedValueOnce(new Error("Recipient not found"));

      await queue.processPendingJobs();

      expect(mockPrisma.campaignLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "failed",
            error: "Recipient not found",
          }),
        })
      );
    });

    it("should retry job on failure when attempts < maxAttempts", async () => {
      mockPrisma.jobQueue.findMany.mockResolvedValueOnce([
        {
          id: "job_1",
          campaignId: "camp_1",
          recipient: "+123",
          recipientName: null,
          recipientId: null,
          templateId: null,
          templateName: null,
          attempts: 0,
          maxAttempts: 3,
        },
      ]);

      mockPrisma.campaign.findUnique.mockResolvedValueOnce({ id: "camp_1", message: "Hello!" });
      mockPrisma.jobQueue.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.jobQueue.update.mockResolvedValueOnce({});
      mockPrisma.campaignLog.create.mockResolvedValueOnce({});
      mockPrisma.jobQueue.count.mockResolvedValueOnce(1);
      mockPrisma.campaign.findUnique.mockResolvedValueOnce({
        id: "camp_1",
        contactList: { contacts: [{ id: "c1" }] },
      });
      mockPrisma.campaign.update.mockResolvedValueOnce({});

      mockEngine.send.mockRejectedValueOnce(new Error("Network error"));

      await queue.processPendingJobs();

      expect(mockPrisma.jobQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "job_1" },
          data: expect.objectContaining({
            status: "pending",
            attempts: 1,
          }),
        })
      );
    });

    it("should mark as failed when attempts >= maxAttempts", async () => {
      mockPrisma.jobQueue.findMany.mockResolvedValueOnce([
        {
          id: "job_1",
          campaignId: "camp_1",
          recipient: "+123",
          recipientName: null,
          recipientId: null,
          templateId: null,
          templateName: null,
          attempts: 2,
          maxAttempts: 3,
        },
      ]);

      mockPrisma.campaign.findUnique.mockResolvedValueOnce({ id: "camp_1", message: "Hello!" });
      mockPrisma.jobQueue.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.jobQueue.update.mockResolvedValueOnce({});
      mockPrisma.campaignLog.create.mockResolvedValueOnce({});
      mockPrisma.jobQueue.count.mockResolvedValueOnce(1);
      mockPrisma.campaign.findUnique.mockResolvedValueOnce({
        id: "camp_1",
        contactList: { contacts: [{ id: "c1" }] },
      });
      mockPrisma.campaign.update.mockResolvedValueOnce({});

      mockEngine.send.mockRejectedValueOnce(new Error("Network error"));

      await queue.processPendingJobs();

      expect(mockPrisma.jobQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "job_1" },
          data: expect.objectContaining({
            status: "failed",
            attempts: 3,
            completedAt: expect.any(Date),
          }),
        })
      );
    });

    it("should skip jobs that cannot be locked (race condition)", async () => {
      mockPrisma.jobQueue.findMany.mockResolvedValueOnce([
        {
          id: "job_1",
          campaignId: "camp_1",
          recipient: "+123",
          recipientName: null,
          recipientId: null,
          templateId: null,
          templateName: null,
          attempts: 0,
          maxAttempts: 3,
        },
      ]);

      mockPrisma.jobQueue.updateMany.mockResolvedValueOnce({ count: 0 });

      await queue.processPendingJobs();
      expect(mockEngine.send).not.toHaveBeenCalled();
    });

    it("should mark job as failed when campaign not found", async () => {
      mockPrisma.jobQueue.findMany.mockResolvedValueOnce([
        {
          id: "job_1",
          campaignId: "camp_1",
          recipient: "+123",
          recipientName: null,
          recipientId: null,
          templateId: null,
          templateName: null,
          attempts: 0,
          maxAttempts: 3,
        },
      ]);

      mockPrisma.jobQueue.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.campaign.findUnique.mockResolvedValueOnce(null);
      mockPrisma.jobQueue.update.mockResolvedValueOnce({});
      mockPrisma.campaignLog.create.mockResolvedValueOnce({});

      await queue.processPendingJobs();

      expect(mockPrisma.jobQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "job_1" },
          data: expect.objectContaining({ status: "failed" }),
        })
      );
      expect(mockEngine.send).not.toHaveBeenCalled();
    });

    it("should mark job as failed when recipient is null", async () => {
      mockPrisma.jobQueue.findMany.mockResolvedValueOnce([
        {
          id: "job_1",
          campaignId: "camp_1",
          recipient: null,
          recipientName: null,
          recipientId: null,
          templateId: null,
          templateName: null,
          attempts: 0,
          maxAttempts: 3,
        },
      ]);

      mockPrisma.jobQueue.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.campaign.findUnique.mockResolvedValueOnce({ id: "camp_1", message: "Hi" });
      mockPrisma.jobQueue.update.mockResolvedValueOnce({});

      await queue.processPendingJobs();
      expect(mockEngine.send).not.toHaveBeenCalled();
    });

    it("should use campaign.message as content", async () => {
      mockPrisma.jobQueue.findMany.mockResolvedValueOnce([
        {
          id: "job_1",
          campaignId: "camp_1",
          recipient: "+123",
          recipientName: null,
          recipientId: null,
          templateId: null,
          templateName: null,
          attempts: 0,
          maxAttempts: 3,
        },
      ]);
      mockPrisma.campaign.findUnique.mockResolvedValueOnce({ id: "camp_1", message: "Custom message" });
      mockPrisma.jobQueue.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.jobQueue.update.mockResolvedValueOnce({});
      mockPrisma.campaignLog.create.mockResolvedValueOnce({});
      mockPrisma.jobQueue.count.mockResolvedValueOnce(1);
      mockPrisma.campaign.findUnique.mockResolvedValueOnce({
        id: "camp_1",
        contactList: { contacts: [{ id: "c1" }] },
      });
      mockPrisma.campaign.update.mockResolvedValueOnce({});
      mockEngine.send.mockResolvedValueOnce(mockSendResponse);

      await queue.processPendingJobs();
      expect(mockEngine.send).toHaveBeenCalledWith({ to: "+123", text: "Custom message" });
    });

    it("should fall back to templateName then description then name when message is empty", async () => {
      mockPrisma.jobQueue.findMany.mockResolvedValueOnce([
        {
          id: "job_1",
          campaignId: "camp_1",
          recipient: "+123",
          recipientName: null,
          recipientId: null,
          templateId: null,
          templateName: "Welcome Template",
          attempts: 0,
          maxAttempts: 3,
        },
      ]);
      mockPrisma.campaign.findUnique.mockResolvedValueOnce({
        id: "camp_1",
        message: null,
        description: null,
        name: "Campaign Name",
      });
      mockPrisma.jobQueue.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.jobQueue.update.mockResolvedValueOnce({});
      mockPrisma.campaignLog.create.mockResolvedValueOnce({});
      mockPrisma.jobQueue.count.mockResolvedValueOnce(1);
      mockPrisma.campaign.findUnique.mockResolvedValueOnce({
        id: "camp_1",
        contactList: { contacts: [{ id: "c1" }] },
      });
      mockPrisma.campaign.update.mockResolvedValueOnce({});
      mockEngine.send.mockResolvedValueOnce(mockSendResponse);

      await queue.processPendingJobs();
      expect(mockEngine.send).toHaveBeenCalledWith({ to: "+123", text: "Welcome Template" });
    });
  });

  describe("checkCampaignCompletion", () => {
    it("should return false when campaign not found", async () => {
      mockPrisma.campaign.findUnique.mockResolvedValueOnce(null);
      const result = await queue.checkCampaignCompletion("nonexistent");
      expect(result).toBe(false);
    });

    it("should return false when campaign has no contacts", async () => {
      mockPrisma.campaign.findUnique.mockResolvedValueOnce({
        id: "camp_1",
        contactList: { contacts: [] },
      });
      const result = await queue.checkCampaignCompletion("camp_1");
      expect(result).toBe(false);
    });

    it("should return false when not all jobs are completed", async () => {
      mockPrisma.campaign.findUnique.mockResolvedValueOnce({
        id: "camp_1",
        contactList: { contacts: [{ id: "c1" }, { id: "c2" }, { id: "c3" }] },
      });
      mockPrisma.jobQueue.count.mockResolvedValueOnce(2);

      const result = await queue.checkCampaignCompletion("camp_1");
      expect(result).toBe(false);
      expect(mockPrisma.campaign.update).not.toHaveBeenCalled();
    });

    it("should mark campaign as completed when all jobs are done", async () => {
      mockPrisma.campaign.findUnique.mockResolvedValueOnce({
        id: "camp_1",
        contactList: { contacts: [{ id: "c1" }, { id: "c2" }] },
      });
      mockPrisma.jobQueue.count.mockResolvedValueOnce(2);
      mockPrisma.campaign.update.mockResolvedValueOnce({ id: "camp_1", status: "completed" });

      const result = await queue.checkCampaignCompletion("camp_1");
      expect(result).toBe(true);
      expect(mockPrisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "camp_1" },
          data: { status: "completed" },
        })
      );
    });
  });

  describe("getQueueStats", () => {
    it("should return aggregated queue stats", async () => {
      mockPrisma.jobQueue.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(20);

      const stats = await queue.getQueueStats();
      expect(stats).toEqual({
        pending: 10,
        processing: 5,
        completed: 3,
        failed: 2,
        total: 20,
      });
    });

    it("should filter by campaignId when provided", async () => {
      mockPrisma.jobQueue.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(5);

      await queue.getQueueStats("camp_1");
      expect(mockPrisma.jobQueue.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ campaignId: "camp_1" }) })
      );
    });
  });

  describe("scheduler lifecycle", () => {
    it("should warn when startScheduler is called in serverless env", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      queue.startScheduler();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("setInterval is not reliable in serverless")
      );
      warnSpy.mockRestore();
    });

    it("should not start multiple intervals", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      queue.startScheduler();
      queue.startScheduler();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });

    it("should stop scheduler gracefully when not started", () => {
      const logSpy = jest.spyOn(console, "log").mockImplementation();
      queue.stopScheduler();
      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  describe("triggerProcessing", () => {
    it("should delegate to processPendingJobs", async () => {
      mockPrisma.jobQueue.findMany.mockResolvedValueOnce([]);
      const logSpy = jest.spyOn(console, "log").mockImplementation();
      await queue.triggerProcessing();
      expect(mockPrisma.jobQueue.findMany).toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });
});
