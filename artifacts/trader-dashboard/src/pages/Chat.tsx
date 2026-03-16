import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageLayout } from "@/components/PageLayout";
import { useE2EEKeys } from "@/hooks/useE2EEKeys";
import { useAuth } from "@workspace/replit-auth-web";
import { getSharedKey, encryptMessage, decryptMessage } from "@/lib/e2ee";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useGetPublicKey,
  useSendChatMessage,
  useGetChatMessages,
  useGetUnreadCount,
  useGetProfile,
} from "@workspace/api-client-react";
import {
  Send, MessageCircle, Shield, Loader2, LogIn, Globe, Lock, Trophy, Crown, Medal,
  Award, User, Heart, Plus, X, Camera, FileText, ArrowLeft, Search, UserPlus,
  UserCheck, UserMinus, Clock, Users, ChevronRight, Trash2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Post {
  id: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  content: string;
  imageUrl: string | null;
  isStory: boolean;
  expiresAt: string | null;
  likesCount: number;
  createdAt: string;
  likedByMe?: boolean;
  isOwnPost?: boolean;
}

interface StoryGroup {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  stories: Post[];
  isOwn: boolean;
}

interface SocialUser {
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  level?: number;
  xp?: number;
  isFollowing?: boolean;
  isMutual?: boolean;
  hasKey?: boolean;
}

interface LeaderboardEntry {
  position: number;
  name: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

const apiFetch = (path: string, opts?: RequestInit) =>
  fetch(`api/${path}`, { credentials: "include", ...opts });

const apiJSON = async (path: string, opts?: RequestInit) => {
  const res = await apiFetch(path, opts);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};

function useFeed() {
  return useQuery<(Post & { likedByMe: boolean; isOwnPost: boolean })[]>({
    queryKey: ["social/feed"],
    queryFn: () => apiJSON("social/feed"),
    refetchInterval: 8000,
  });
}

function useStories() {
  return useQuery<StoryGroup[]>({
    queryKey: ["social/stories"],
    queryFn: () => apiJSON("social/stories"),
    refetchInterval: 30000,
  });
}

function useMutualFollowers() {
  return useQuery<SocialUser[]>({
    queryKey: ["social/mutual-followers"],
    queryFn: () => apiJSON("social/mutual-followers"),
    refetchInterval: 15000,
  });
}

function useLeaderboard() {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
    queryFn: () => apiJSON("leaderboard"),
  });
}

function useFollowStatus(targetId: string | null) {
  return useQuery<{ isFollowing: boolean; isMutual: boolean }>({
    queryKey: ["social/follow-status", targetId],
    queryFn: () => apiJSON(`social/follow-status/${targetId}`),
    enabled: !!targetId,
  });
}

function useUserProfile(userId: string | null) {
  return useQuery({
    queryKey: ["social/profile", userId],
    queryFn: () => apiJSON(`social/profile/${userId}`),
    enabled: !!userId,
  });
}

function useSocialSearch(q: string) {
  return useQuery<SocialUser[]>({
    queryKey: ["social/search", q],
    queryFn: () => apiJSON(`social/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
  });
}

// ─── Shared components ────────────────────────────────────────────────────────

function Avatar({ name, avatarUrl, size = "md", ring }: { name: string; avatarUrl?: string | null; size?: "xs" | "sm" | "md" | "lg"; ring?: string }) {
  const s = size === "xs" ? "w-7 h-7 text-[10px]" : size === "sm" ? "w-9 h-9 text-xs" : size === "lg" ? "w-16 h-16 text-xl" : "w-10 h-10 text-sm";
  const ringCls = ring ? `ring-2 ${ring}` : "";
  if (avatarUrl) return <img src={avatarUrl} alt={name} className={`${s} ${ringCls} rounded-full object-cover border border-border flex-shrink-0`} />;
  return <div className={`${s} ${ringCls} rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary flex-shrink-0`}>{name.charAt(0).toUpperCase()}</div>;
}

function PositionBadge({ position }: { position: number }) {
  if (position === 1) return <div className="w-8 h-8 rounded-full bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center"><Crown className="w-4 h-4 text-yellow-400" /></div>;
  if (position === 2) return <div className="w-8 h-8 rounded-full bg-slate-300/20 border border-slate-400/50 flex items-center justify-center"><Medal className="w-4 h-4 text-slate-300" /></div>;
  if (position === 3) return <div className="w-8 h-8 rounded-full bg-amber-700/20 border border-amber-600/50 flex items-center justify-center"><Award className="w-4 h-4 text-amber-600" /></div>;
  return <div className="w-8 h-8 rounded-full bg-secondary/50 border border-border flex items-center justify-center"><span className="text-xs font-bold font-mono text-muted-foreground">#{position}</span></div>;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ora";
  if (m < 60) return `${m}m fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h fa`;
  return `${Math.floor(h / 24)}g fa`;
}

// ─── User Profile Modal ───────────────────────────────────────────────────────

function UserProfileModal({ userId, currentUserId, onClose, onStartChat }: { userId: string; currentUserId: string; onClose: () => void; onStartChat?: (u: SocialUser) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useUserProfile(userId);

  const follow = useMutation({
    mutationFn: () => apiJSON(`social/follow/${userId}`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["social/follow-status", userId] }); qc.invalidateQueries({ queryKey: ["social/mutual-followers"] }); qc.invalidateQueries({ queryKey: ["social/profile", userId] }); },
  });
  const unfollow = useMutation({
    mutationFn: () => apiJSON(`social/follow/${userId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["social/follow-status", userId] }); qc.invalidateQueries({ queryKey: ["social/mutual-followers"] }); qc.invalidateQueries({ queryKey: ["social/profile", userId] }); },
  });

  if (isLoading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-8" onClick={e => e.stopPropagation()}><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
    </div>
  );

  const { profile, posts, followersCount, followingCount, isFollowing, isMutual, isOwnProfile } = data ?? {};

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <Avatar name={profile?.name ?? "?"} avatarUrl={profile?.avatarUrl} size="lg" ring="ring-primary/40" />
              <div>
                <p className="font-bold text-lg">{profile?.name}</p>
                <p className="text-xs text-muted-foreground">Livello {profile?.level} · {profile?.xp?.toLocaleString()} XP</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex gap-6 mb-4 text-center">
            <div><p className="font-bold">{followersCount ?? 0}</p><p className="text-xs text-muted-foreground">Follower</p></div>
            <div><p className="font-bold">{followingCount ?? 0}</p><p className="text-xs text-muted-foreground">Following</p></div>
            <div><p className="font-bold">{posts?.length ?? 0}</p><p className="text-xs text-muted-foreground">Post</p></div>
          </div>

          {!isOwnProfile && (
            <div className="flex gap-2 mb-5">
              {isFollowing ? (
                <button onClick={() => unfollow.mutate()} disabled={unfollow.isPending} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-border text-sm font-medium hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors">
                  <UserMinus className="w-4 h-4" /> Smetti di seguire
                </button>
              ) : (
                <button onClick={() => follow.mutate()} disabled={follow.isPending} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                  <UserPlus className="w-4 h-4" /> Segui
                </button>
              )}
              {isMutual && onStartChat && (
                <button
                  onClick={() => { onStartChat({ userId, name: profile?.name ?? "Trader", avatarUrl: profile?.avatarUrl ?? null, isMutual: true }); onClose(); }}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-primary/10 text-primary border border-primary/30 text-sm font-medium hover:bg-primary/20 transition-colors"
                >
                  <Lock className="w-4 h-4" /> Messaggio
                </button>
              )}
            </div>
          )}

          {isMutual && !isOwnProfile && (
            <div className="flex items-center gap-1.5 text-xs text-primary mb-4 bg-primary/10 rounded-lg px-3 py-2">
              <UserCheck className="w-3.5 h-3.5" /> Si seguono a vicenda · Chat disponibile
            </div>
          )}

          {posts && posts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Post</p>
              <div className="space-y-3">
                {posts.map((p: Post) => (
                  <div key={p.id} className="bg-secondary/30 rounded-xl p-3 text-sm">
                    <p className="text-foreground/90 whitespace-pre-wrap">{p.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{p.likesCount}</span>
                      <span>{timeAgo(p.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Story Viewer ─────────────────────────────────────────────────────────────

function StoryViewer({ groups, startIndex, onClose }: { groups: StoryGroup[]; startIndex: number; onClose: () => void }) {
  const [groupIdx, setGroupIdx] = useState(startIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout>();

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];
  const totalInGroup = group?.stories.length ?? 1;

  useEffect(() => {
    setProgress(0);
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(intervalRef.current);
          advance();
          return 0;
        }
        return p + 2;
      });
    }, 100);
    return () => clearInterval(intervalRef.current);
  }, [groupIdx, storyIdx]);

  const advance = () => {
    if (storyIdx < totalInGroup - 1) { setStoryIdx(s => s + 1); }
    else if (groupIdx < groups.length - 1) { setGroupIdx(g => g + 1); setStoryIdx(0); }
    else { onClose(); }
  };

  if (!story) return null;

  const timeLeft = story.expiresAt ? Math.max(0, Math.floor((new Date(story.expiresAt).getTime() - Date.now()) / 3600000)) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" onClick={advance}>
      <div className="w-full max-w-sm h-full max-h-[700px] relative rounded-2xl overflow-hidden bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="absolute top-0 left-0 right-0 p-3 z-10 flex gap-1">
          {group.stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
              <div className={`h-full bg-white transition-none rounded-full ${i < storyIdx ? "w-full" : i === storyIdx ? "" : "w-0"}`}
                style={i === storyIdx ? { width: `${progress}%`, transition: "width 0.1s linear" } : {}} />
            </div>
          ))}
        </div>
        <div className="absolute top-6 left-0 right-0 p-4 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar name={group.userName} avatarUrl={group.avatarUrl} size="sm" ring="ring-white/50" />
            <div>
              <p className="text-white text-sm font-semibold">{group.userName}</p>
              <p className="text-white/60 text-xs flex items-center gap-1"><Clock className="w-3 h-3" />{timeLeft}h rimaste</p>
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-2 rounded-full bg-white/10">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="absolute inset-0 flex items-center justify-center p-6 pt-24">
          {story.imageUrl ? (
            <img src={story.imageUrl} className="w-full h-full object-contain rounded-xl" />
          ) : (
            <p className="text-white text-lg text-center leading-relaxed font-medium">{story.content}</p>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60">
          {!story.imageUrl ? null : <p className="text-white/90 text-sm text-center">{story.content}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Create Post Modal ────────────────────────────────────────────────────────

function CreatePostModal({ onClose, currentUserId }: { onClose: () => void; currentUserId: string }) {
  const [content, setContent] = useState("");
  const [isStory, setIsStory] = useState(false);
  const qc = useQueryClient();

  const createPost = useMutation({
    mutationFn: (data: { content: string; isStory: boolean }) =>
      apiJSON("social/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social/feed"] });
      qc.invalidateQueries({ queryKey: ["social/stories"] });
      onClose();
    },
  });

  const handleSubmit = () => {
    if (!content.trim()) return;
    createPost.mutate({ content: content.trim(), isStory });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">Nuovo {isStory ? "Storia" : "Post"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsStory(false)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all border ${!isStory ? "bg-primary/10 text-primary border-primary/30" : "border-border text-muted-foreground hover:border-primary/20"}`}
          >
            <FileText className="w-4 h-4" /> Post Permanente
          </button>
          <button
            onClick={() => setIsStory(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all border ${isStory ? "bg-primary/10 text-primary border-primary/30" : "border-border text-muted-foreground hover:border-primary/20"}`}
          >
            <Clock className="w-4 h-4" /> Storia 24h
          </button>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={isStory ? "Cosa vuoi condividere per 24 ore?" : "Cosa stai pensando?"}
          rows={5}
          maxLength={2000}
          className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary resize-none transition-colors"
          autoFocus
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{content.length}/2000</span>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || createPost.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {createPost.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Pubblica
          </button>
        </div>

        {isStory && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-amber-400">
            <Clock className="w-3.5 h-3.5" /> La storia scomparirà automaticamente dopo 24 ore
          </p>
        )}
      </motion.div>
    </div>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({ post, currentUserId, onViewProfile }: { post: Post & { likedByMe: boolean; isOwnPost: boolean }; currentUserId: string; onViewProfile: (id: string) => void }) {
  const qc = useQueryClient();
  const [liked, setLiked] = useState(post.likedByMe);
  const [count, setCount] = useState(post.likesCount);

  const like = useMutation({
    mutationFn: () => apiJSON(`social/posts/${post.id}/like`, { method: "POST" }),
    onSuccess: (data: { liked: boolean }) => {
      setLiked(data.liked);
      setCount(c => data.liked ? c + 1 : c - 1);
    },
  });

  const deletePost = useMutation({
    mutationFn: () => apiJSON(`social/posts/${post.id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social/feed"] }),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card/60 backdrop-blur-sm border border-border rounded-2xl overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <button onClick={() => onViewProfile(post.userId)} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <Avatar name={post.userName} avatarUrl={post.avatarUrl} size="sm" />
            <div className="text-left">
              <p className="text-sm font-semibold leading-tight">{post.userName}</p>
              <p className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}</p>
            </div>
          </button>
          {post.isOwnPost && (
            <button onClick={() => deletePost.mutate()} disabled={deletePost.isPending} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed mb-3">{post.content}</p>
        {post.imageUrl && <img src={post.imageUrl} alt="post" className="w-full rounded-xl mb-3 object-cover max-h-64" />}
        <button
          onClick={() => like.mutate()}
          className={`flex items-center gap-1.5 text-sm transition-all ${liked ? "text-red-400" : "text-muted-foreground hover:text-red-400"}`}
        >
          <motion.div animate={{ scale: liked ? [1, 1.3, 1] : 1 }} transition={{ duration: 0.2 }}>
            <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
          </motion.div>
          <span className="font-medium">{count}</span>
        </button>
      </div>
    </motion.div>
  );
}

// ─── SOCIAL TAB ───────────────────────────────────────────────────────────────

function SocialTab({ currentUserId, onStartChat }: { currentUserId: string; onStartChat: (u: SocialUser) => void }) {
  const { data: feed = [], isLoading: feedLoading } = useFeed();
  const { data: storyGroups = [] } = useStories();
  const [viewingStories, setViewingStories] = useState<{ groups: StoryGroup[]; index: number } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const { data: searchResults = [] } = useSocialSearch(searchQ);
  const qc = useQueryClient();

  const follow = useMutation({
    mutationFn: (uid: string) => apiJSON(`social/follow/${uid}`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["social/search", searchQ] }); qc.invalidateQueries({ queryKey: ["social/mutual-followers"] }); },
  });
  const unfollow = useMutation({
    mutationFn: (uid: string) => apiJSON(`social/follow/${uid}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["social/search", searchQ] }); qc.invalidateQueries({ queryKey: ["social/mutual-followers"] }); },
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-border flex items-center gap-2 shrink-0">
        <div className="flex-1 flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary shrink-0" />
          {showSearch ? (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="Cerca trader..." autoFocus
                className="w-full pl-9 pr-4 py-1.5 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
          ) : (
            <p className="font-semibold text-sm">Social</p>
          )}
        </div>
        <button onClick={() => { setShowSearch(s => !s); setSearchQ(""); }} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary transition-colors">
          {showSearch ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
        </button>
        <button onClick={() => setShowCreate(true)} className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {showSearch && searchQ.length >= 2 ? (
          <div className="p-4 space-y-2">
            {searchResults.map(u => u.userId && (
              <div key={u.userId} className="flex items-center gap-3 p-3 bg-card/40 rounded-xl border border-border">
                <button onClick={() => setViewingProfile(u.userId!)}>
                  <Avatar name={u.name} avatarUrl={u.avatarUrl} size="sm" />
                </button>
                <div className="flex-1 min-w-0" onClick={() => setViewingProfile(u.userId!)}>
                  <p className="text-sm font-semibold truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground">Lv.{u.level} · {u.xp?.toLocaleString()} XP</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {u.isMutual && <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">Mutual</span>}
                  {u.isFollowing ? (
                    <button onClick={() => unfollow.mutate(u.userId!)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <UserMinus className="w-4 h-4" />
                    </button>
                  ) : (
                    <button onClick={() => follow.mutate(u.userId!)} className="p-1.5 rounded-lg text-primary bg-primary/10 hover:bg-primary/20 transition-colors">
                      <UserPlus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {searchResults.length === 0 && searchQ.length >= 2 && (
              <p className="text-center text-muted-foreground text-sm py-8">Nessun utente trovato</p>
            )}
          </div>
        ) : (
          <>
            {storyGroups.length > 0 && (
              <div className="p-4 border-b border-border shrink-0">
                <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
                  <div onClick={() => setShowCreate(true)} className="flex flex-col items-center gap-1 cursor-pointer shrink-0">
                    <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-dashed border-primary/40 flex items-center justify-center hover:bg-primary/20 transition-colors">
                      <Plus className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">Aggiungi</span>
                  </div>
                  {storyGroups.map((group, i) => (
                    <div key={group.userId} onClick={() => setViewingStories({ groups: storyGroups, index: i })} className="flex flex-col items-center gap-1 cursor-pointer shrink-0">
                      <div className={`p-0.5 rounded-full ${group.isOwn ? "bg-gradient-to-tr from-primary to-primary/60" : "bg-gradient-to-tr from-pink-500 to-orange-400"}`}>
                        <Avatar name={group.userName} avatarUrl={group.avatarUrl} size="md" />
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[56px]">{group.isOwn ? "Tu" : group.userName.split(" ")[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {storyGroups.length === 0 && (
              <div className="px-4 pt-4">
                <button onClick={() => setShowCreate(true)} className="w-full flex items-center gap-3 p-3 bg-card/40 border border-dashed border-border rounded-xl text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><Plus className="w-4 h-4 text-primary" /></div>
                  <div className="text-left">
                    <p className="text-sm font-medium">Aggiungi una storia</p>
                    <p className="text-xs">Condividi il tuo trading per 24 ore</p>
                  </div>
                </button>
              </div>
            )}

            <div className="p-4 space-y-4">
              {feedLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : feed.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground space-y-3">
                  <Users className="w-12 h-12 mx-auto opacity-20" />
                  <p className="font-medium">Nessun post nel feed</p>
                  <p className="text-sm">Cerca e segui altri trader per vedere i loro post!</p>
                  <button onClick={() => setShowSearch(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm hover:bg-primary/20 transition-colors">
                    <Search className="w-4 h-4" /> Cerca trader
                  </button>
                </div>
              ) : (
                feed.map(post => (
                  <PostCard key={post.id} post={post} currentUserId={currentUserId} onViewProfile={setViewingProfile} />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {viewingStories && (
        <StoryViewer groups={viewingStories.groups} startIndex={viewingStories.index} onClose={() => setViewingStories(null)} />
      )}
      {showCreate && <CreatePostModal onClose={() => setShowCreate(false)} currentUserId={currentUserId} />}
      {viewingProfile && (
        <UserProfileModal
          userId={viewingProfile} currentUserId={currentUserId}
          onClose={() => setViewingProfile(null)}
          onStartChat={(u) => { setViewingProfile(null); onStartChat(u); }}
        />
      )}
    </div>
  );
}

// ─── MESSAGGI TAB (E2EE con mutual followers) ─────────────────────────────────

function MessaggiTab({ currentUser }: { currentUser: { id: string } }) {
  const { keyPair, isReady: e2eeReady, error: e2eeError } = useE2EEKeys(currentUser.id);
  const [selectedFriend, setSelectedFriend] = useState<SocialUser | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [messageInput, setMessageInput] = useState("");
  const [decryptedMessages, setDecryptedMessages] = useState<Array<{ id: number; senderId: string; text: string; createdAt: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: mutualFollowers = [], isLoading } = useMutualFollowers();
  const { data: unreadData } = useGetUnreadCount({ query: { refetchInterval: 5000 } });

  const { data: friendPublicKeyData } = useGetPublicKey(
    selectedFriend?.userId ?? "",
    { query: { enabled: !!selectedFriend?.userId } }
  );

  const { data: messagesData, refetch: refetchMessages } = useGetChatMessages(
    selectedFriend?.userId ?? "",
    {},
    { query: { enabled: !!selectedFriend?.userId, refetchInterval: 3000 } }
  );

  const sendMessageMutation = useSendChatMessage();

  useEffect(() => {
    if (!messagesData?.messages || !keyPair || !friendPublicKeyData?.publicKeyJwk) return;
    const decrypt = async () => {
      try {
        const sharedKey = await getSharedKey(keyPair.privateKey, friendPublicKeyData.publicKeyJwk as JsonWebKey);
        const decrypted = await Promise.all(
          messagesData.messages.map(async (msg) => ({
            id: msg.id, senderId: msg.senderId,
            text: await decryptMessage(msg.ciphertext, msg.iv, sharedKey),
            createdAt: msg.createdAt,
          }))
        );
        setDecryptedMessages(decrypted);
      } catch (err) { console.error("Decrypt error:", err); }
    };
    decrypt();
  }, [messagesData?.messages, keyPair, friendPublicKeyData?.publicKeyJwk]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [decryptedMessages]);

  const handleSendMessage = useCallback(async () => {
    if (!messageInput.trim() || !selectedFriend?.userId || !keyPair || !friendPublicKeyData?.publicKeyJwk) return;
    try {
      const sharedKey = await getSharedKey(keyPair.privateKey, friendPublicKeyData.publicKeyJwk as JsonWebKey);
      const { ciphertext, iv } = await encryptMessage(messageInput.trim(), sharedKey);
      await sendMessageMutation.mutateAsync({ data: { receiverId: selectedFriend.userId, ciphertext, iv } });
      setMessageInput("");
      refetchMessages();
    } catch (err) { console.error("Send error:", err); }
  }, [messageInput, selectedFriend, keyPair, friendPublicKeyData, sendMessageMutation, refetchMessages]);

  const handleSelect = (u: SocialUser) => { setSelectedFriend(u); setDecryptedMessages([]); setMobileView("chat"); };

  if (e2eeError) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-4">
        <Shield className="w-16 h-16 mx-auto text-destructive opacity-40" />
        <p className="text-muted-foreground text-sm">Errore crittografia</p>
        <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm">Riprova</button>
      </div>
    </div>
  );

  if (!e2eeReady) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground text-sm">Inizializzazione crittografia...</p>
      </div>
    </div>
  );

  const list = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          <p className="font-semibold text-sm">Messaggi E2EE</p>
        </div>
        {(unreadData as any)?.count > 0 && (
          <span className="px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full font-bold">{(unreadData as any).count}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (mutualFollowers as SocialUser[]).length === 0 ? (
          <div className="text-center py-12 px-4 text-muted-foreground space-y-3">
            <UserCheck className="w-12 h-12 mx-auto opacity-20" />
            <p className="font-medium text-sm">Nessun contatto disponibile</p>
            <p className="text-xs leading-relaxed">Per chattare devi seguire un trader che ti segue a vicenda. Vai nel tab Social per trovare e seguire altri trader!</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {(mutualFollowers as SocialUser[]).map(u => (
              <div
                key={u.userId}
                onClick={() => handleSelect(u)}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedFriend?.userId === u.userId ? "bg-primary/10 border border-primary/30" : "hover:bg-white/5 border border-transparent"}`}
              >
                <Avatar name={u.name} avatarUrl={u.avatarUrl} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.name}</p>
                  <p className="text-xs text-primary flex items-center gap-1"><UserCheck className="w-3 h-3" /> Si seguono a vicenda</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const chatArea = (
    <div className="flex flex-col h-full">
      {selectedFriend ? (
        <>
          <div className="p-4 border-b border-border flex items-center gap-3">
            <button onClick={() => { setSelectedFriend(null); setMobileView("list"); }} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground lg:hidden">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Avatar name={selectedFriend.name} avatarUrl={selectedFriend.avatarUrl} size="md" />
            <div>
              <p className="font-medium text-sm">{selectedFriend.name}</p>
              <p className="text-xs text-primary flex items-center gap-1"><Shield className="w-3 h-3" /> Crittografia end-to-end</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {decryptedMessages.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-12">
                <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Inizio conversazione cifrata</p>
              </div>
            ) : (
              decryptedMessages.map(msg => {
                const isMine = msg.senderId !== selectedFriend.userId;
                return (
                  <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isMine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card/80 border border-border rounded-bl-md"}`}>
                      <p className="break-words whitespace-pre-wrap">{msg.text}</p>
                      <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {new Date(msg.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input
                type="text" value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                placeholder="Scrivi un messaggio cifrato..."
                className="flex-1 px-4 py-2.5 bg-card/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
              />
              <button onClick={handleSendMessage} disabled={!messageInput.trim() || sendMessageMutation.isPending} className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground space-y-3">
            <Lock className="w-16 h-16 mx-auto opacity-20" />
            <p className="text-sm">Seleziona un contatto</p>
            <p className="text-xs">Solo i mutual follow possono chattare</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full">
      <div className="hidden lg:grid grid-cols-[280px_1fr] h-full">
        <div className="border-r border-border">{list}</div>
        <div>{chatArea}</div>
      </div>
      <div className="lg:hidden h-full">
        {mobileView === "list" ? list : chatArea}
      </div>
    </div>
  );
}

// ─── CLASSIFICA TAB ───────────────────────────────────────────────────────────

function ClassificaTab() {
  const { data: leaderboard, isLoading } = useLeaderboard();
  const { data: profile } = useGetProfile();

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center gap-2 shrink-0">
        <Trophy className="w-4 h-4 text-yellow-400" />
        <div>
          <p className="font-semibold text-sm">Classifica Trader</p>
          <p className="text-xs text-muted-foreground">Ranking per XP e livello</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : !leaderboard || leaderboard.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground"><Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" /><p className="text-sm">Nessun trader in classifica.</p></div>
        ) : (
          <div className="divide-y divide-border/50">
            {leaderboard.map((entry, idx) => {
              const isMe = profile && entry.name === profile.name;
              return (
                <motion.div key={entry.position} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
                  className={`px-4 py-3 flex items-center gap-3 transition-colors hover:bg-secondary/20 ${isMe ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}
                >
                  <PositionBadge position={entry.position} />
                  <div className="w-9 h-9 rounded-full border border-border/50 overflow-hidden bg-secondary flex-shrink-0">
                    {entry.avatarUrl ? <img src={entry.avatarUrl} alt={entry.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><User className="w-4 h-4 text-muted-foreground" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isMe ? "text-primary" : ""}`}>{entry.name}{isMe && <span className="ml-1.5 text-[10px] text-primary/70">(tu)</span>}</p>
                    <p className="text-xs text-muted-foreground">Livello {entry.level}</p>
                  </div>
                  <div className="bg-secondary/80 border border-border px-2 py-0.5 rounded-md">
                    <span className="text-xs font-bold font-mono text-accent">{entry.xp.toLocaleString()} XP</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

type Tab = "social" | "messaggi" | "classifica";

export default function Chat() {
  const { isAuthenticated, isLoading: authLoading, login, user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("social");
  const [pendingChat, setPendingChat] = useState<SocialUser | null>(null);

  const handleStartChat = (u: SocialUser) => {
    setActiveTab("messaggi");
    setPendingChat(u);
  };

  useEffect(() => {
    if (activeTab === "messaggi" && pendingChat) {
      setPendingChat(null);
    }
  }, [activeTab]);

  if (authLoading) return (
    <PageLayout><div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></PageLayout>
  );

  if (!isAuthenticated) return (
    <PageLayout>
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <Globe className="w-16 h-16 mx-auto text-primary opacity-40" />
          <h2 className="text-xl font-bold">Community Trader</h2>
          <p className="text-muted-foreground">Accedi per entrare nella community, pubblicare post e chattare con gli altri trader</p>
          <button onClick={() => login()} className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors">
            <LogIn className="w-4 h-4" /> Accedi
          </button>
        </div>
      </div>
    </PageLayout>
  );

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "social", label: "Social", icon: <Globe className="w-4 h-4" /> },
    { id: "messaggi", label: "Messaggi", icon: <Lock className="w-4 h-4" /> },
    { id: "classifica", label: "Classifica", icon: <Trophy className="w-4 h-4" /> },
  ];

  return (
    <PageLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card/30 backdrop-blur-md border border-border rounded-2xl overflow-hidden flex flex-col"
        style={{ height: "calc(100vh - 140px)" }}
      >
        <div className="flex border-b border-border shrink-0">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all ${activeTab === tab.id ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
            >
              {tab.icon}<span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === "social" && <SocialTab currentUserId={user?.id ?? ""} onStartChat={handleStartChat} />}
          {activeTab === "messaggi" && <MessaggiTab currentUser={{ id: user?.id ?? "" }} />}
          {activeTab === "classifica" && <ClassificaTab />}
        </div>
      </motion.div>
    </PageLayout>
  );
}
