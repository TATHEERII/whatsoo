import { GET, POST } from "@/app/api/auth/[...nextauth]/route";
import { handlers } from "@/auth";

jest.mock("@/auth", () => ({
  handlers: {
    GET: jest.fn(),
    POST: jest.fn(),
  },
  auth: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

describe("/api/auth/[...nextauth]", () => {
  it("should export GET handler from NextAuth", () => {
    expect(GET).toBeDefined();
    expect(typeof GET).toBe("function");
  });

  it("should export POST handler from NextAuth", () => {
    expect(POST).toBeDefined();
    expect(typeof POST).toBe("function");
  });

  it("should re-export handlers from auth module", () => {
    expect(handlers.GET).toBe(GET);
    expect(handlers.POST).toBe(POST);
  });
});
