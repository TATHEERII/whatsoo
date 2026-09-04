import { POST, DELETE } from "@/app/api/scheduler/route";
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
  getQueueStats: jest.fn(async () => ({ pending: 0, processing: 0, completed: 0, failed: 0, total: 0 })),
  startScheduler: jest.fn(),
  enqueueCampaign: jest.fn(async () => 0),
};

jest.mock("@/lib/sqliteQueue", () => ({
  getSqliteQueueService: jest.fn(() => mockQueue),
}));

describe("/api/scheduler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST", () => {
    it("should return 401 when not authenticated", async () => {
      const { auth } = require("@/auth");
      auth.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/scheduler", { method: "POST" });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("should trigger processing and return completed", async () => {
      mockQueue.triggerProcessing.mockResolvedValueOnce(undefined);

      const req = new Request("http://localhost/api/scheduler", { method: "POST" });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("completed");
      expect(mockQueue.triggerProcessing).toHaveBeenCalled();
    });

    it("should call triggerProcessing exactly once", async () => {
      mockQueue.triggerProcessing.mockResolvedValueOnce(undefined);

      const req = new Request("http://localhost/api/scheduler", { method: "POST" });
      await POST(req);
      await POST(req);
      expect(mockQueue.triggerProcessing).toHaveBeenCalledTimes(2);
    });
  });

  describe("DELETE", () => {
    it("should return 401 when not authenticated", async () => {
      const { auth } = require("@/auth");
      auth.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/scheduler", { method: "DELETE" });
      const res = await DELETE(req);
      expect(res.status).toBe(401);
    });

    it("should stop scheduler and return stopped", async () => {
      const req = new Request("http://localhost/api/scheduler", { method: "DELETE" });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("stopped");
      expect(mockQueue.stopScheduler).toHaveBeenCalled();
    });
  });
});
