import { getAuth } from "@clerk/express";
import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import { db, loginAccessTable } from "@workspace/db";
import { and, eq, gte } from "drizzle-orm";
import { requestContext, type RequestContext } from "../lib/logger";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

// In-memory dedup cache: "userId:ip" → last-logged timestamp (ms)
const recentAccess = new Map<string, number>();
const DEDUP_TTL = 60 * 60 * 1000; // 1 hour

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? "unknown";
}

async function recordAccess(userId: string, ip: string, userAgent: string | undefined) {
  const key = `${userId}:${ip}`;
  const now = Date.now();
  const last = recentAccess.get(key);
  if (last && now - last < DEDUP_TTL) return; // already logged recently

  recentAccess.set(key, now);

  // Also check DB — avoid duplicates surviving a server restart (within 1 h)
  const since = new Date(now - DEDUP_TTL);
  const [existing] = await db
    .select({ id: loginAccessTable.id })
    .from(loginAccessTable)
    .where(
      and(
        eq(loginAccessTable.userId, userId),
        eq(loginAccessTable.ipAddress, ip),
        gte(loginAccessTable.createdAt, since),
      ),
    )
    .limit(1);

  if (!existing) {
    await db.insert(loginAccessTable).values({
      userId,
      ipAddress: ip,
      userAgent: userAgent ?? null,
    });
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const { userId } = getAuth(req);
  if (userId) {
    req.user = {
      id: userId,
      email: null,
      firstName: null,
      lastName: null,
      profileImageUrl: null,
    };

    // ── Inietta userId nel contesto AsyncLocalStorage per il logging distribuito ──
    const store = requestContext.getStore() as RequestContext | undefined;
    if (store) {
      store.userId = userId;
    }

    // Fire-and-forget: record this IP access in the background
    const ip = getClientIp(req);
    const ua = req.headers["user-agent"];
    recordAccess(userId, ip, ua).catch(() => {});
  }
  next();
}
