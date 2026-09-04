import { mockUser } from "./mockUser";

export { mockUser };

export const mockSession = {
  user: {
    id: mockUser.id,
    name: mockUser.name,
    email: mockUser.email,
    image: mockUser.image,
    role: "user" as const,
  },
  expires: new Date(Date.now() + 3600 * 1000).toISOString(),
};

export const mockSessionWithoutUser = null;

export function mockAuth(session: typeof mockSession | null = mockSession) {
  jest.doMock("@/auth", () => ({
    auth: jest.fn(async () => session),
    signIn: jest.fn(),
    signOut: jest.fn(),
    handlers: { GET: jest.fn(), POST: jest.fn() },
  }));
}

export function getMockAuth() {
  return require("@/auth").auth as jest.Mock;
}
