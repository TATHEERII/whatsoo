import prisma from "@/lib/prisma";

type MinimalUser = {
  id?: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

/**
 * Ensures a User row exists for the authenticated principal.
 *
 * This app uses JWT sessions (no NextAuth DB adapter), so signing in with
 * Google does not create a DB user. Every create route keys ownership on
 * `userId`, which would otherwise violate the foreign key. We lazily upsert
 * the user from the session the first time it's needed.
 *
 * If a user with the same email but a different ID already exists (e.g.,
 * created manually or via another auth flow), we return the existing ID
 * rather than failing on the unique email constraint.
 */
export async function ensureUser(
  user: MinimalUser | null | undefined
): Promise<string | null> {
  const id = user?.id;
  const email = user?.email;
  if (!id || !email) return null;

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (existing) {
      await prisma.user.update({
        where: { id },
        data: {
          name: user?.name ?? undefined,
          email,
          image: user?.image ?? undefined,
        },
      });
      return existing.id;
    }

    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) return byEmail.id;

    const created = await prisma.user.create({
      data: {
        id,
        name: user?.name ?? undefined,
        email,
        image: user?.image ?? undefined,
      },
    });
    return created.id;
  } catch (e) {
    const err = e as { message?: string; code?: string };
    console.error("ENSURE_USER_ERROR:", err?.message ?? String(e), "code:", err?.code);
    try {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      return byEmail?.id ?? null;
    } catch {
      return null;
    }
  }
}
