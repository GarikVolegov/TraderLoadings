import { Router, type IRouter } from "express";
import { db, followsTable, postsTable, postLikesTable, profileTable, userPublicKeysTable } from "@workspace/db";
import { eq, and, or, desc, sql, inArray, gt, isNull } from "drizzle-orm";

const router: IRouter = Router();

function requireAuth(req: any, res: any): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return null;
  }
  return userId;
}

async function isMutualFollow(userA: string, userB: string): Promise<boolean> {
  const [aFollowsB, bFollowsA] = await Promise.all([
    db.select({ id: followsTable.id }).from(followsTable)
      .where(and(eq(followsTable.followerId, userA), eq(followsTable.followingId, userB))).limit(1),
    db.select({ id: followsTable.id }).from(followsTable)
      .where(and(eq(followsTable.followerId, userB), eq(followsTable.followingId, userA))).limit(1),
  ]);
  return aFollowsB.length > 0 && bFollowsA.length > 0;
}

async function getProfile(userId: string) {
  const [profile] = await db
    .select({ name: profileTable.name, avatarUrl: profileTable.avatarUrl })
    .from(profileTable)
    .where(eq(profileTable.userId, userId))
    .limit(1);
  return profile;
}

router.post("/social/follow/:targetId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { targetId } = req.params;
  if (targetId === userId) { res.status(400).json({ error: "Non puoi seguire te stesso" }); return; }
  try {
    const existing = await db.select().from(followsTable)
      .where(and(eq(followsTable.followerId, userId), eq(followsTable.followingId, targetId))).limit(1);
    if (existing.length > 0) { res.status(409).json({ error: "Già seguito" }); return; }
    const [row] = await db.insert(followsTable).values({ followerId: userId, followingId: targetId }).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("follow error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.delete("/social/follow/:targetId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { targetId } = req.params;
  try {
    await db.delete(followsTable).where(and(eq(followsTable.followerId, userId), eq(followsTable.followingId, targetId)));
    res.json({ success: true });
  } catch (err) {
    console.error("unfollow error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/social/follow-status/:targetId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { targetId } = req.params;
  try {
    const [isFollowing, isMutual] = await Promise.all([
      db.select({ id: followsTable.id }).from(followsTable)
        .where(and(eq(followsTable.followerId, userId), eq(followsTable.followingId, targetId))).limit(1),
      isMutualFollow(userId, targetId),
    ]);
    res.json({ isFollowing: isFollowing.length > 0, isMutual });
  } catch (err) {
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/social/followers", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const rows = await db.select({ followerId: followsTable.followerId })
      .from(followsTable).where(eq(followsTable.followingId, userId));
    const ids = rows.map(r => r.followerId);
    if (ids.length === 0) { res.json([]); return; }
    const profiles = await db.select({ userId: profileTable.userId, name: profileTable.name, avatarUrl: profileTable.avatarUrl, level: profileTable.level, xp: profileTable.xp })
      .from(profileTable).where(inArray(profileTable.userId, ids));
    const mutuals = await Promise.all(profiles.map(async p => ({ ...p, isMutual: await isMutualFollow(userId, p.userId!) })));
    res.json(mutuals);
  } catch (err) {
    console.error("followers error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/social/following", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const rows = await db.select({ followingId: followsTable.followingId })
      .from(followsTable).where(eq(followsTable.followerId, userId));
    const ids = rows.map(r => r.followingId);
    if (ids.length === 0) { res.json([]); return; }
    const profiles = await db.select({ userId: profileTable.userId, name: profileTable.name, avatarUrl: profileTable.avatarUrl, level: profileTable.level, xp: profileTable.xp })
      .from(profileTable).where(inArray(profileTable.userId, ids));
    const mutuals = await Promise.all(profiles.map(async p => ({ ...p, isMutual: await isMutualFollow(userId, p.userId!) })));
    res.json(mutuals);
  } catch (err) {
    console.error("following error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/social/search", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const q = String(req.query.q || "").trim();
  if (q.length < 2) { res.json([]); return; }
  try {
    const results = await db.select({
      userId: profileTable.userId,
      name: profileTable.name,
      avatarUrl: profileTable.avatarUrl,
      level: profileTable.level,
      xp: profileTable.xp,
    }).from(profileTable)
      .where(and(sql`${profileTable.name} ILIKE ${`%${q}%`}`, sql`${profileTable.userId} IS NOT NULL`, sql`${profileTable.userId} != ${userId}`))
      .limit(20);
    const enriched = await Promise.all(results.map(async r => ({
      ...r,
      isFollowing: (await db.select().from(followsTable).where(and(eq(followsTable.followerId, userId), eq(followsTable.followingId, r.userId!))).limit(1)).length > 0,
      isMutual: await isMutualFollow(userId, r.userId!),
    })));
    res.json(enriched);
  } catch (err) {
    console.error("search error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.post("/social/posts", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const { content, imageUrl, isStory } = req.body;
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({ error: "Contenuto vuoto" });
      return;
    }
    if (content.trim().length > 2000) {
      res.status(400).json({ error: "Contenuto troppo lungo (max 2000 caratteri)" });
      return;
    }
    const profile = await getProfile(userId);
    const expiresAt = isStory ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;
    const [post] = await db.insert(postsTable).values({
      userId,
      userName: profile?.name ?? "Trader",
      avatarUrl: profile?.avatarUrl ?? null,
      content: content.trim(),
      imageUrl: imageUrl ?? null,
      isStory: !!isStory,
      expiresAt,
    }).returning();
    res.status(201).json(post);
  } catch (err) {
    console.error("post create error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.delete("/social/posts/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
    const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id)).limit(1);
    if (!post) { res.status(404).json({ error: "Post non trovato" }); return; }
    if (post.userId !== userId) { res.status(403).json({ error: "Non autorizzato" }); return; }
    await db.delete(postsTable).where(eq(postsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("post delete error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.post("/social/posts/:id/like", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
    const existing = await db.select().from(postLikesTable)
      .where(and(eq(postLikesTable.postId, id), eq(postLikesTable.userId, userId))).limit(1);
    if (existing.length > 0) {
      await db.delete(postLikesTable).where(and(eq(postLikesTable.postId, id), eq(postLikesTable.userId, userId)));
      await db.update(postsTable).set({ likesCount: sql`GREATEST(0, ${postsTable.likesCount} - 1)` }).where(eq(postsTable.id, id));
      res.json({ liked: false });
    } else {
      await db.insert(postLikesTable).values({ postId: id, userId });
      await db.update(postsTable).set({ likesCount: sql`${postsTable.likesCount} + 1` }).where(eq(postsTable.id, id));
      res.json({ liked: true });
    }
  } catch (err) {
    console.error("like error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/social/feed", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const followingRows = await db.select({ followingId: followsTable.followingId })
      .from(followsTable).where(eq(followsTable.followerId, userId));
    const followingIds = [...followingRows.map(r => r.followingId), userId];

    const now = new Date();
    const posts = await db.select().from(postsTable)
      .where(and(
        inArray(postsTable.userId, followingIds),
        eq(postsTable.isStory, false),
        or(isNull(postsTable.expiresAt), gt(postsTable.expiresAt, now))
      ))
      .orderBy(desc(postsTable.createdAt))
      .limit(50);

    const likedRows = posts.length > 0
      ? await db.select({ postId: postLikesTable.postId }).from(postLikesTable)
          .where(and(inArray(postLikesTable.postId, posts.map(p => p.id)), eq(postLikesTable.userId, userId)))
      : [];
    const likedSet = new Set(likedRows.map(r => r.postId));

    const followingSet = new Set(followingIds);
    res.json(posts.map(p => ({ ...p, likedByMe: likedSet.has(p.id), isOwnPost: p.userId === userId })));
  } catch (err) {
    console.error("feed error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/social/stories", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const followingRows = await db.select({ followingId: followsTable.followingId })
      .from(followsTable).where(eq(followsTable.followerId, userId));
    const followingIds = [...followingRows.map(r => r.followingId), userId];

    const now = new Date();
    const stories = await db.select().from(postsTable)
      .where(and(
        inArray(postsTable.userId, followingIds),
        eq(postsTable.isStory, true),
        gt(postsTable.expiresAt, now)
      ))
      .orderBy(desc(postsTable.createdAt))
      .limit(50);

    const grouped: Record<string, typeof stories> = {};
    for (const s of stories) {
      if (!grouped[s.userId]) grouped[s.userId] = [];
      grouped[s.userId].push(s);
    }

    const result = Object.entries(grouped).map(([uid, userStories]) => ({
      userId: uid,
      userName: userStories[0].userName,
      avatarUrl: userStories[0].avatarUrl,
      stories: userStories,
      isOwn: uid === userId,
    }));

    const sorted = result.sort((a, b) => (a.isOwn ? -1 : 1));
    res.json(sorted);
  } catch (err) {
    console.error("stories error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/social/profile/:targetUserId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { targetUserId } = req.params;
  try {
    const [profile] = await db.select().from(profileTable)
      .where(eq(profileTable.userId, targetUserId)).limit(1);
    if (!profile) { res.status(404).json({ error: "Profilo non trovato" }); return; }

    const [posts, followersCount, followingCount, isFollowing, mutual] = await Promise.all([
      db.select().from(postsTable)
        .where(and(eq(postsTable.userId, targetUserId), eq(postsTable.isStory, false)))
        .orderBy(desc(postsTable.createdAt)).limit(30),
      db.select({ count: sql<number>`count(*)::int` }).from(followsTable).where(eq(followsTable.followingId, targetUserId)),
      db.select({ count: sql<number>`count(*)::int` }).from(followsTable).where(eq(followsTable.followerId, targetUserId)),
      db.select().from(followsTable).where(and(eq(followsTable.followerId, userId), eq(followsTable.followingId, targetUserId))).limit(1),
      isMutualFollow(userId, targetUserId),
    ]);

    res.json({
      profile,
      posts,
      followersCount: followersCount[0]?.count ?? 0,
      followingCount: followingCount[0]?.count ?? 0,
      isFollowing: isFollowing.length > 0,
      isMutual: mutual,
      isOwnProfile: targetUserId === userId,
    });
  } catch (err) {
    console.error("profile error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/social/mutual-followers", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const following = await db.select({ followingId: followsTable.followingId })
      .from(followsTable).where(eq(followsTable.followerId, userId));
    const followingIds = following.map(r => r.followingId);
    if (followingIds.length === 0) { res.json([]); return; }

    const mutuals = [];
    for (const fid of followingIds) {
      const backFollow = await db.select().from(followsTable)
        .where(and(eq(followsTable.followerId, fid), eq(followsTable.followingId, userId))).limit(1);
      if (backFollow.length > 0) mutuals.push(fid);
    }
    if (mutuals.length === 0) { res.json([]); return; }

    const profiles = await db.select({
      userId: profileTable.userId,
      name: profileTable.name,
      avatarUrl: profileTable.avatarUrl,
    }).from(profileTable).where(inArray(profileTable.userId, mutuals));

    const withKeys = await Promise.all(profiles.map(async p => {
      const [keyRow] = await db.select({ publicKeyJwk: userPublicKeysTable.publicKeyJwk })
        .from(userPublicKeysTable).where(eq(userPublicKeysTable.userId, p.userId!)).limit(1);
      return { ...p, hasKey: !!keyRow };
    }));

    res.json(withKeys);
  } catch (err) {
    console.error("mutual-followers error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

export default router;
