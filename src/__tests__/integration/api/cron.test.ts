import { GET, POST } from "@/app/api/cron/process-jobs/route";
import { mockSession } from "../../utils/mockAuth";

jest.mock("@/auth", () => ({
  auth: jest.fn(async () => mockSession),
  handlers: { GET: jest.fn(), POST: jest.fn() },
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

const mockQueue = {
  triggerProcessing: jest.fn(async () => {}),
  stopScheduler: jest.fn(),
  processPendingJobs: jest.fn(async () => {}),
  getQueueStats: jest.fn(async () => ({ pending: 5, processing: 2, completed: 10, failed: 1, total: 18 })),
  startScheduler: jest.fn(),
  enqueueCampaign: jest.fn(async () => 0),
};

jest.mock("@/lib/sqliteQueue", () => ({
  getSqliteQueueService: jest.fn(() => mockQueue),
}));

describe("/api/cron/process-jobs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET", () => {
    it("should return 200 and process pending jobs when token is valid", async () => {
      process.env.CRON_SECRET_TOKEN = "valid-token";

      const req = new Request("http://localhost/api/cron/process-jobs?token=valid-token");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("completed");
      expect(data.timestamp).toBeDefined();
      expect(data.stats).toEqual({ pending: 5, processing: 2, completed: 10, failed: 1, total: 18 });
      expect(mockQueue.processPendingJobs).toHaveBeenCalled();
    });

    it("should return 200 when no token is configured in env", async () => {
      const originalToken = process.env.CRON_SECRET_TOKEN;
      delete process.env.CRON_SECRET_TOKEN;

      const req = new Request("http://localhost/api/cron/process-jobs");
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(mockQueue.processPendingJobs).toHaveBeenCalled();

      if (originalToken) process.env.CRON_SECRET_TOKEN = originalToken;
    });

    it("should return 401 when token is invalid", async () => {
      process.env.CRON_SECRET_TOKEN = "valid-token";

      const req = new Request("http://localhost/api/cron/process-jobs?token=wrong-token");
      const res = await GET(req);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
      expect(mockQueue.processPendingJobs).not.toHaveBeenCalled();
    });

    it("should return 401 when token is missing but configured in env", async () => {
      process.env.CRON_SECRET_TOKEN = "valid-token";

      const req = new Request("http://localhost/api/cron/process-jobs");
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("should return 500 when processing fails", async () => {
      delete process.env.CRON_SECRET_TOKEN;
      mockQueue.processPendingJobs.mockRejectedValueOnce(new Error("DB Error"));

      const req = new Request("http://localhost/api/cron/process-jobs");
      const res = await GET(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe("Failed to process jobs");
      expect(data.message).toBe("DB Error");
    });
  });

  describe("POST", () => {
    it("should also support POST method for manual triggering", async () => {
      delete process.env.CRON_SECRET_TOKEN;

      const req = new Request("http://localhost/api/cron/process-jobs", { method: "POST" });
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(mockQueue.processPendingJobs).toHaveBeenCalled();
    });

    it("should return 401 on POST when token is invalid", async () => {
      process.env.CRON_SECRET_TOKEN = "valid-token";

      const req = new Request("http://localhost/api/cron/process-jobs?token=wrong", { method: "POST" });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });
});
