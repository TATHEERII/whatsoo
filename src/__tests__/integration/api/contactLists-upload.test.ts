jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: require("../../utils/mockPrisma").mockPrisma,
}));

jest.mock("@/lib/ensureUser", () => ({
  ensureUser: jest.fn(async () => "user_123"),
}));

jest.mock("@/auth", () => ({
  auth: jest.fn(async () => require("../../utils/mockAuth").mockSession),
  handlers: { GET: jest.fn(), POST: jest.fn() },
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock("csv-parse/sync", () => ({
  parse: jest.fn((text: string) => {
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const record: Record<string, string> = {};
      headers.forEach((h, i) => { record[h] = values[i] || ""; });
      return record;
    });
  }),
}));

import { POST } from "@/app/api/contact-lists/[id]/upload/route";
import { mockPrisma } from "../../utils/mockPrisma";
const { parse } = require("csv-parse/sync");

function createMultipartRequest(url: string, csvContent: string): Request {
  const boundary = "----TestBoundary123";
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="contacts.csv"\r\n` +
    `Content-Type: text/csv\r\n\r\n` +
    `${csvContent}\r\n` +
    `--${boundary}--\r\n`;

  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
}

describe("/api/contact-lists/[id]/upload", () => {
  const params = { id: "list_123" };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.contactList.findFirst.mockResolvedValueOnce({
      id: "list_123", name: "Test List", userId: "user_123",
    });
    (parse as jest.Mock).mockClear();
    (parse as jest.Mock).mockImplementation((text: string) => {
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) return [];
      const headers = lines[0].split(",").map((h: string) => h.trim().toLowerCase());
      return lines.slice(1).map((line: string) => {
        const values = line.split(",").map((v: string) => v.trim());
        const record: Record<string, string> = {};
        headers.forEach((h: string, i: number) => { record[h] = values[i] || ""; });
        return record;
      });
    });
  });

  it("should return 401 when not authenticated", async () => {
    const { auth } = require("@/auth");
    auth.mockResolvedValueOnce(null);

    const req = createMultipartRequest(
      "http://localhost/api/contact-lists/list_123/upload",
      "name,phone,email\nJohn,+123,john@test.com"
    );
    const res = await POST(req, { params });
    expect(res.status).toBe(401);
  });

  it("should return 404 when contact list not found", async () => {
    mockPrisma.contactList.findFirst.mockReset();
    mockPrisma.contactList.findFirst.mockResolvedValueOnce(null);

    const req = createMultipartRequest(
      "http://localhost/api/contact-lists/nonexistent/upload",
      "name,phone,email\nJohn,+123,john@test.com"
    );
    const res = await POST(req, { params: { id: "nonexistent" } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Contact list not found" });
  });

    it("should return 400 when no file is uploaded", async () => {
      const boundary = "----TestBoundary";
      const body =
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="submit"\r\n\r\n` +
        `submit\r\n` +
        `--${boundary}--\r\n`;

      const req = new Request("http://localhost/api/contact-lists/list_123/upload", {
        method: "POST",
        headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
        body,
      });
      const res = await POST(req, { params });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "No file uploaded" });
    });

  it("should return 400 when CSV is empty", async () => {
    const req = createMultipartRequest(
      "http://localhost/api/contact-lists/list_123/upload",
      ""
    );
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "CSV file is empty" });
  });

  it("should import contacts from standard CSV format", async () => {
    mockPrisma.contact.create.mockImplementation(async ({ data }) => ({
      id: "contact_1", name: data.name, phoneNumber: data.phoneNumber, email: data.email,
      userId: data.userId, contactListId: data.contactListId,
      createdAt: new Date(), updatedAt: new Date(),
    }));

    const csv = "name,phone,email\nJohn Doe,+1234567890,john@example.com\nJane Smith,+0987654321,jane@example.com";
    const req = createMultipartRequest("http://localhost/api/contact-lists/list_123/upload", csv);
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.imported).toBe(2);
    expect(data.skipped).toHaveLength(0);
    expect(data.contacts).toHaveLength(2);
  });

  it("should skip contacts with missing phone numbers", async () => {
    mockPrisma.contact.create.mockImplementation(async ({ data }) => ({
      id: "contact_1", name: data.name, phoneNumber: data.phoneNumber, email: data.email,
      userId: data.userId, contactListId: data.contactListId,
      createdAt: new Date(), updatedAt: new Date(),
    }));

    const csv = "name,phone,email\nJohn,,john@example.com\nJane,+123,jane@example.com";
    const req = createMultipartRequest("http://localhost/api/contact-lists/list_123/upload", csv);
    const res = await POST(req, { params });
    const data = await res.json();
    expect(data.imported).toBe(1);
    expect(data.skipped).toHaveLength(1);
    expect(data.skipped[0].reason).toBe("Missing phone number");
  });

  it("should handle phone column variations (phone_number)", async () => {
    mockPrisma.contact.create.mockImplementation(async ({ data }) => ({
      id: "contact_1", name: data.name, phoneNumber: data.phoneNumber, email: data.email,
      userId: data.userId, contactListId: data.contactListId,
      createdAt: new Date(), updatedAt: new Date(),
    }));

    const csv = "full_name,phone_number,email_address\nJohn,+123,john@test.com";
    const req = createMultipartRequest("http://localhost/api/contact-lists/list_123/upload", csv);
    const res = await POST(req, { params });
    const data = await res.json();
    expect(data.imported).toBe(1);
    expect(data.contacts[0].name).toBe("John");
  });

  it("should skip duplicate phone numbers (P2002 error)", async () => {
    mockPrisma.contact.create
      .mockResolvedValueOnce({
        id: "contact_1", name: "John", phoneNumber: "+123", email: null,
        userId: "user_123", contactListId: "list_123", createdAt: new Date(), updatedAt: new Date(),
      })
      .mockRejectedValueOnce({ code: "P2002", meta: { target: ["userId", "phoneNumber"] } });

    const csv = "name,phone,email\nJohn,+123,\nJohn,+123,";
    const req = createMultipartRequest("http://localhost/api/contact-lists/list_123/upload", csv);
    const res = await POST(req, { params });
    const data = await res.json();
    expect(data.imported).toBe(1);
    expect(data.skipped).toHaveLength(1);
    expect(data.skipped[0].reason).toBe("Phone number already exists");
  });

  it("should skip duplicate emails (P2002 error)", async () => {
    mockPrisma.contact.create
      .mockResolvedValueOnce({
        id: "contact_1", name: "John", phoneNumber: "+123", email: "john@test.com",
        userId: "user_123", contactListId: "list_123", createdAt: new Date(), updatedAt: new Date(),
      })
      .mockRejectedValueOnce({ code: "P2002", meta: { target: ["userId", "email"] } });

    const csv = "name,phone,email\nJohn,+123,john@test.com\nJane,+456,john@test.com";
    const req = createMultipartRequest("http://localhost/api/contact-lists/list_123/upload", csv);
    const res = await POST(req, { params });
    const data = await res.json();
    expect(data.imported).toBe(1);
    expect(data.skipped).toHaveLength(1);
    expect(data.skipped[0].reason).toContain("Duplicate email");
  });

  it("should use trimmed phone and name values", async () => {
    mockPrisma.contact.create.mockImplementation(async ({ data }) => ({
      id: "contact_1", name: data.name, phoneNumber: data.phoneNumber, email: data.email,
      userId: data.userId, contactListId: data.contactListId,
      createdAt: new Date(), updatedAt: new Date(),
    }));

    const csv = "name,phone,email\n  John Doe  ,  +1234567890  ,  john@test.com  ";
    const req = createMultipartRequest("http://localhost/api/contact-lists/list_123/upload", csv);
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    expect(mockPrisma.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "John Doe", phoneNumber: "+1234567890" }),
      })
    );
  });

  it("should use phone as name when name is missing", async () => {
    mockPrisma.contact.create.mockImplementation(async ({ data }) => ({
      id: "contact_1", name: data.name, phoneNumber: data.phoneNumber, email: data.email,
      userId: data.userId, contactListId: data.contactListId,
      createdAt: new Date(), updatedAt: new Date(),
    }));

    const csv = "name,phone,email\n,+1234567890,";
    const req = createMultipartRequest("http://localhost/api/contact-lists/list_123/upload", csv);
    const res = await POST(req, { params });
    const data = await res.json();
    expect(data.imported).toBe(1);
    expect(mockPrisma.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "+1234567890" }) })
    );
  });

  it("should return 500 when CSV processing fails", async () => {
    (parse as jest.Mock).mockImplementationOnce(() => {
      throw new Error("Parse error");
    });

    const req = createMultipartRequest(
      "http://localhost/api/contact-lists/list_123/upload",
      "name,phone\nJohn,+123"
    );
    const res = await POST(req, { params });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to process CSV file" });
  });
});
