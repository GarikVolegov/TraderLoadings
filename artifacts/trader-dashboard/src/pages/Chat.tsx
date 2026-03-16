import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { PageLayout } from "@/components/PageLayout";
import { useE2EEKeys } from "@/hooks/useE2EEKeys";
import { useAuth } from "@workspace/replit-auth-web";
import { getSharedKey, encryptMessage, decryptMessage } from "@/lib/e2ee";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useGetFriends,
  useSearchUsers,
  useSendFriendRequest,
  useGetPendingFriendRequests,
  useRespondToFriendRequest,
  useRemoveFriend,
  useGetPublicKey,
  useSendChatMessage,
  useGetChatMessages,
  useGetUnreadCount,
  useGetProfile,
} from "@workspace/api-client-react";
import {
  UserPlus,
  Check,
  X,
  Send,
  MessageCircle,
  Users,
  ArrowLeft,
  Shield,
  Loader2,
  Trash2,
  Search,
  LogIn,
  Globe,
  Lock,
  Trophy,
  Crown,
  Medal,
  Award,
  User,
} from "lucide-react";

interface GlobalMessage {
  id: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  message: string;
  createdAt: string;
}

interface LeaderboardEntry {
  position: number;
  name: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
}

function useGlobalChat() {
  return useQuery<{ messages: GlobalMessage[]; nextCursor: number | null }>({
    queryKey: ["chat/global"],
    queryFn: async () => {
      const res = await fetch("api/chat/global", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch global chat");
      return res.json();
    },
    refetchInterval: 3000,
  });
}

function useSendGlobalMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch("api/chat/global", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error("Send failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat/global"] }),
  });
}

function useLeaderboard() {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
    queryFn: async () => {
      const res = await fetch("api/leaderboard", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
  });
}

function Avatar({ name, avatarUrl, size = "md" }: { name: string; avatarUrl?: string | null; size?: "sm" | "md" }) {
  const s = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${s} rounded-full object-cover border border-border`} />;
  }
  return (
    <div className={`${s} rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function PositionBadge({ position }: { position: number }) {
  if (position === 1) return (
    <div className="w-8 h-8 rounded-full bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center shadow-[0_0_12px_rgba(234,179,8,0.3)]">
      <Crown className="w-4 h-4 text-yellow-400" />
    </div>
  );
  if (position === 2) return (
    <div className="w-8 h-8 rounded-full bg-slate-300/20 border border-slate-400/50 flex items-center justify-center">
      <Medal className="w-4 h-4 text-slate-300" />
    </div>
  );
  if (position === 3) return (
    <div className="w-8 h-8 rounded-full bg-amber-700/20 border border-amber-600/50 flex items-center justify-center">
      <Award className="w-4 h-4 text-amber-600" />
    </div>
  );
  return (
    <div className="w-8 h-8 rounded-full bg-secondary/50 border border-border flex items-center justify-center">
      <span className="text-xs font-bold font-mono text-muted-foreground">#{position}</span>
    </div>
  );
}

function GlobalChatTab({ currentUserId }: { currentUserId: string }) {
  const { data, isLoading } = useGlobalChat();
  const sendMutation = useSendGlobalMessage();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const messages = data?.messages ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    if (!input.trim() || sendMutation.isPending) return;
    const text = input.trim();
    setInput("");
    await sendMutation.mutateAsync(text);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Globe className="w-4 h-4 text-primary" />
        <div>
          <p className="font-semibold text-sm">Canale Trader</p>
          <p className="text-xs text-muted-foreground">Chat pubblica per tutti i trader</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nessun messaggio ancora.</p>
            <p className="text-xs mt-1">Sii il primo a scrivere nel canale!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.userId === currentUserId;
            return (
              <div key={msg.id} className={`flex gap-2.5 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                {!isMine && <Avatar name={msg.userName} avatarUrl={msg.avatarUrl} size="sm" />}
                <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[75%]`}>
                  {!isMine && (
                    <span className="text-[10px] text-muted-foreground font-medium mb-1 ml-1">{msg.userName}</span>
                  )}
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                    isMine
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-card/80 border border-border rounded-bl-md"
                  }`}>
                    <p className="break-words whitespace-pre-wrap">{msg.message}</p>
                    <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Scrivi nel canale..."
            className="flex-1 px-4 py-2.5 bg-card/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function PrivateChatTab({ currentUser }: { currentUser: { id: string } }) {
  const { keyPair, isReady: e2eeReady, error: e2eeError } = useE2EEKeys(currentUser.id);
  const [selectedFriend, setSelectedFriend] = useState<{ friendUserId: string; name: string; friendshipId: number } | null>(null);
  const [mobileView, setMobileView] = useState<"friends" | "chat">("friends");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [decryptedMessages, setDecryptedMessages] = useState<Array<{ id: number; senderId: string; text: string; createdAt: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: friends = [], refetch: refetchFriends } = useGetFriends({ query: { refetchInterval: 10000 } });
  const { data: pendingRequests = [], refetch: refetchRequests } = useGetPendingFriendRequests({ query: { refetchInterval: 10000 } });
  const { data: searchResults = [] } = useSearchUsers({ q: searchQuery }, { query: { enabled: searchQuery.length >= 2 } });
  const { data: unreadData } = useGetUnreadCount({ query: { refetchInterval: 5000 } });

  const sendFriendRequestMutation = useSendFriendRequest();
  const respondMutation = useRespondToFriendRequest();
  const removeFriendMutation = useRemoveFriend();
  const sendMessageMutation = useSendChatMessage();

  const { data: friendPublicKeyData } = useGetPublicKey(
    selectedFriend?.friendUserId ?? "",
    { query: { enabled: !!selectedFriend?.friendUserId } }
  );

  const { data: messagesData, refetch: refetchMessages } = useGetChatMessages(
    selectedFriend?.friendUserId ?? "",
    {},
    { query: { enabled: !!selectedFriend?.friendUserId, refetchInterval: 3000 } }
  );

  useEffect(() => {
    if (!messagesData?.messages || !keyPair || !friendPublicKeyData?.publicKeyJwk) return;
    const decrypt = async () => {
      try {
        const sharedKey = await getSharedKey(keyPair.privateKey, friendPublicKeyData.publicKeyJwk as JsonWebKey);
        const decrypted = await Promise.all(
          messagesData.messages.map(async (msg) => ({
            id: msg.id,
            senderId: msg.senderId,
            text: await decryptMessage(msg.ciphertext, msg.iv, sharedKey),
            createdAt: msg.createdAt,
          }))
        );
        setDecryptedMessages(decrypted);
      } catch (err) {
        console.error("Decrypt error:", err);
      }
    };
    decrypt();
  }, [messagesData?.messages, keyPair, friendPublicKeyData?.publicKeyJwk]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [decryptedMessages]);

  const handleSendMessage = useCallback(async () => {
    if (!messageInput.trim() || !selectedFriend || !keyPair || !friendPublicKeyData?.publicKeyJwk) return;
    try {
      const sharedKey = await getSharedKey(keyPair.privateKey, friendPublicKeyData.publicKeyJwk as JsonWebKey);
      const { ciphertext, iv } = await encryptMessage(messageInput.trim(), sharedKey);
      await sendMessageMutation.mutateAsync({ data: { receiverId: selectedFriend.friendUserId, ciphertext, iv } });
      setMessageInput("");
      refetchMessages();
    } catch (err) {
      console.error("Send error:", err);
    }
  }, [messageInput, selectedFriend, keyPair, friendPublicKeyData, sendMessageMutation, refetchMessages]);

  const handleSelectFriend = (f: { friendUserId: string; name: string; friendshipId: number }) => {
    setSelectedFriend(f);
    setDecryptedMessages([]);
    setMobileView("chat");
  };

  const handleSendFriendRequest = async (friendUserId: string) => {
    try {
      await sendFriendRequestMutation.mutateAsync({ data: { friendUserId } });
      setSearchQuery("");
      setShowSearch(false);
    } catch {}
  };

  const handleRespondRequest = async (id: number, action: "accept" | "reject") => {
    try {
      await respondMutation.mutateAsync({ id, data: { action } });
      refetchRequests();
      refetchFriends();
    } catch {}
  };

  const handleRemoveFriend = async (id: number) => {
    try {
      await removeFriendMutation.mutateAsync({ id });
      if (selectedFriend?.friendshipId === id) {
        setSelectedFriend(null);
        setMobileView("friends");
      }
      refetchFriends();
    } catch {}
  };

  if (e2eeError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Shield className="w-16 h-16 mx-auto text-destructive opacity-40" />
          <h2 className="text-xl font-bold">Errore crittografia</h2>
          <p className="text-muted-foreground text-sm">Impossibile inizializzare la crittografia.</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm">
            Riprova
          </button>
        </div>
      </div>
    );
  }

  if (!e2eeReady) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Inizializzazione crittografia...</p>
        </div>
      </div>
    );
  }

  const friendsSidebar = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Amici
            {(unreadData as any)?.count > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded-full font-bold">
                {(unreadData as any).count}
              </span>
            )}
          </h2>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary transition-colors"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>
        {showSearch && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca utenti..."
                className="w-full pl-9 pr-4 py-2 bg-card/50 border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                autoFocus
              />
            </div>
            {searchResults.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {searchResults.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5">
                    <div className="flex items-center gap-2">
                      <Avatar name={user.name} avatarUrl={null} size="sm" />
                      <span className="text-sm">{user.name}</span>
                    </div>
                    <button
                      onClick={() => user.userId && handleSendFriendRequest(user.userId)}
                      className="p-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {pendingRequests.length > 0 && (
        <div className="p-3 border-b border-border">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">
            Richieste ({pendingRequests.length})
          </p>
          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between p-2 rounded-lg bg-card/30">
                <div className="flex items-center gap-2">
                  <Avatar name={req.senderName ?? "?"} size="sm" />
                  <span className="text-sm">{req.senderName ?? "Sconosciuto"}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleRespondRequest(req.id, "accept")} className="p-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleRespondRequest(req.id, "reject")} className="p-1.5 rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/30">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {(friends as any[]).length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            <Lock className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nessun amico ancora.</p>
            <p className="text-xs mt-1">Cerca e aggiungi amici!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {(friends as any[]).map((friend: any) => (
              <div
                key={friend.friendshipId}
                onClick={() => handleSelectFriend(friend)}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all group ${
                  selectedFriend?.friendUserId === friend.friendUserId
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-white/5 border border-transparent"
                }`}
              >
                <div className="relative">
                  <Avatar name={friend.name} avatarUrl={friend.avatarUrl} size="md" />
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
                    friend.online ? "bg-primary" : "bg-muted-foreground/40"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{friend.name}</p>
                  <p className="text-xs text-muted-foreground">{friend.online ? "Online" : "Offline"}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveFriend(friend.friendshipId); }}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
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
            <button onClick={() => { setSelectedFriend(null); setMobileView("friends"); }} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground lg:hidden">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Avatar name={selectedFriend.name} size="md" />
            <div>
              <p className="font-medium text-sm">{selectedFriend.name}</p>
              <p className="text-xs text-primary flex items-center gap-1">
                <Shield className="w-3 h-3" /> Crittografia end-to-end
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {decryptedMessages.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-12">
                <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Inizio conversazione cifrata</p>
                <p className="text-xs mt-1">I messaggi sono protetti E2EE</p>
              </div>
            ) : (
              decryptedMessages.map((msg) => {
                const isMine = msg.senderId !== selectedFriend.friendUserId;
                return (
                  <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                      isMine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card/80 border border-border rounded-bl-md"
                    }`}>
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
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                placeholder="Scrivi un messaggio..."
                className="flex-1 px-4 py-2.5 bg-card/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
              />
              <button
                onClick={handleSendMessage}
                disabled={!messageInput.trim() || sendMessageMutation.isPending}
                className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground space-y-3">
            <Lock className="w-16 h-16 mx-auto opacity-20" />
            <p className="text-sm">Seleziona un amico per chattare</p>
            <p className="text-xs">I messaggi sono protetti E2EE</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full">
      <div className="hidden lg:grid grid-cols-[300px_1fr] h-full">
        <div className="border-r border-border">{friendsSidebar}</div>
        <div>{chatArea}</div>
      </div>
      <div className="lg:hidden h-full">
        {mobileView === "friends" ? friendsSidebar : chatArea}
      </div>
    </div>
  );
}

function LeaderboardTab() {
  const { data: leaderboard, isLoading } = useLeaderboard();
  const { data: profile } = useGetProfile();

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Trophy className="w-4 h-4 text-yellow-400" />
        <div>
          <p className="font-semibold text-sm">Classifica Trader</p>
          <p className="text-xs text-muted-foreground">Ranking per XP e livello</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !leaderboard || leaderboard.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nessun trader in classifica.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {leaderboard.map((entry, idx) => {
              const isCurrentUser = profile && entry.name === profile.name;
              return (
                <motion.div
                  key={`${entry.position}-${entry.name}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className={`px-4 py-3 flex items-center gap-3 transition-colors hover:bg-secondary/20 ${
                    isCurrentUser ? "bg-primary/10 border-l-2 border-l-primary" : ""
                  }`}
                >
                  <PositionBadge position={entry.position} />
                  <div className="w-9 h-9 rounded-full border border-border/50 overflow-hidden bg-secondary flex-shrink-0">
                    {entry.avatarUrl ? (
                      <img src={entry.avatarUrl} alt={entry.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isCurrentUser ? "text-primary" : ""}`}>
                      {entry.name}
                      {isCurrentUser && <span className="ml-1.5 text-[10px] text-primary/70">(tu)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">Livello {entry.level}</p>
                  </div>
                  <div className="flex items-center gap-1 bg-secondary/80 border border-border px-2 py-0.5 rounded-md">
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

type Tab = "canale" | "privato" | "classifica";

export default function Chat() {
  const { isAuthenticated, isLoading: authLoading, login, user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("canale");

  if (authLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-4">
            <MessageCircle className="w-16 h-16 mx-auto text-primary opacity-40" />
            <h2 className="text-xl font-bold">Community Trader</h2>
            <p className="text-muted-foreground">Accedi per chattare con la community e vedere la classifica</p>
            <button
              onClick={() => login()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Accedi
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "canale", label: "Canale", icon: <Globe className="w-4 h-4" /> },
    { id: "privato", label: "Privato", icon: <Lock className="w-4 h-4" /> },
    { id: "classifica", label: "Classifica", icon: <Trophy className="w-4 h-4" /> },
  ];

  return (
    <PageLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card/30 backdrop-blur-md border border-border rounded-2xl overflow-hidden flex flex-col"
        style={{ height: "calc(100vh - 140px)" }}
      >
        <div className="flex border-b border-border shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === "canale" && <GlobalChatTab currentUserId={user?.id ?? ""} />}
          {activeTab === "privato" && <PrivateChatTab currentUser={{ id: user?.id ?? "" }} />}
          {activeTab === "classifica" && <LeaderboardTab />}
        </div>
      </motion.div>
    </PageLayout>
  );
}
