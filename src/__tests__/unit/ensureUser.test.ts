import { ensureUser } from "@/lib/ensureUser";
import { mockPrisma, mockUser } from "../utils/mockPrisma";
import { mockSession } from "../utils/mockAuth";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: require("../utils/mockPrisma").mockPrisma,
}));

describe("ensureUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return null when user is null", async () => {
    const result = await ensureUser(null);
    expect(result).toBeNull();
  });

  it("should return null when user is undefined", async () => {
    const result = await ensureUser(undefined);
    expect(result).toBeNull();
  });

  it("should return null when user has no id", async () => {
    const result = await ensureUser({ email: "test@test.com" });
    expect(result).toBeNull();
  });

  it("should return null when user has no email", async () => {
    const result = await ensureUser({ id: "user_123" });
    expect(result).toBeNull();
  });

  it("should return existing user id when user already exists in DB", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
    mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, name: "Updated" });

    const result = await ensureUser({
      id: "user_123",
      email: "test@example.com",
      name: "Updated Name",
      image: "https://example.com/new.png",
    });
    expect(result).toBe("user_123");
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: "user_123" } });
    expect(mockPrisma.user.update).toHaveBeenCalled();
  });

  it("should create new user when not in DB", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.create.mockResolvedValueOnce({ ...mockUser, id: "user_123" });

    const result = await ensureUser({
      id: "user_123",
      email: "test@example.com",
      name: "New User",
      image: "https://example.com/avatar.png",
    });
    expect(result).toBe("user_123");
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: "user_123",
          email: "test@example.com",
          name: "New User",
        }),
      })
    );
  });

  it("should return existing user id found by email when DB lookup by id fails", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ ...mockUser, id: "existing_id" });

    const result = await ensureUser({
      id: "new_id",
      email: "existing@test.com",
      name: "New",
    });
    expect(result).toBe("existing_id");
  });

  it("should handle DB errors and fall back to email lookup", async () => {
    mockPrisma.user.findUnique.mockRejectedValueOnce(new Error("DB Error"));
    mockPrisma.user.findUnique.mockResolvedValueOnce({ ...mockUser, id: "existing_id" });

    const result = await ensureUser({
      id: "new_id",
      email: "existing@test.com",
      name: "New",
    });
    expect(result).toBe("existing_id");
  });

  it("should return null when all DB operations fail", async () => {
    mockPrisma.user.findUnique.mockRejectedValueOnce(new Error("DB Error"));
    mockPrisma.user.findUnique.mockRejectedValueOnce(new Error("DB Error"));

    const result = await ensureUser({
      id: "new_id",
      email: "test@test.com",
      name: "New",
    });
    expect(result).toBeNull();
  });

  it("should update user when email matches and id differs but existing user by email returns existing", async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...mockUser, id: "old_id", email: "test@test.com" });

    const result = await ensureUser({
      id: "new_id",
      email: "test@test.com",
    });
    expect(result).toBe("old_id");
  });
});
