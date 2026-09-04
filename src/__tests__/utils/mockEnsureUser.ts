import { mockUser } from "./mockUser";

jest.mock("@/lib/ensureUser", () => ({
  ensureUser: jest.fn(async () => require("./mockUser").mockUser.id),
}));

export { mockUser };
