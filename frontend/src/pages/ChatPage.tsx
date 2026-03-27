import { useEffect, useRef, useState, useCallback } from "react";
import { Hash, Lock, Users, Search, X } from "lucide-react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { format, isSameDay } from "date-fns";
import { ko } from "date-fns/locale";

import type { Message, Channel } from "@/types";
import { MessageItem } from "@/components/chat/MessageItem";
import { MessageInput } from "@/components/chat/MessageInput";
import { ThreadPanel } from "@/components/chat/ThreadPanel";
import { messageApi, channelApi } from "@/api/chat.api";
import { useChatStore } from "@/stores/chatStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import { toast } from "sonner";

interface ChatPageProps {
  channel: Channel;
}

export function ChatPage({ channel }: ChatPageProps) {
  const { messages, setMessages, prependMessages, typingUsers } = useChatStore();
  const channelMessages = messages[channel.id] || [];

  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [threadMessage, setThreadMessage] = useState<Message | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { sendEvent } = useWebSocket();

  // 채널 입장 시 구독 & 메시지 로드
  useEffect(() => {
    sendEvent("join_channel", { channel_id: channel.id });
    channelApi.markRead(channel.id);
    loadMessages();

    return () => {
      sendEvent("leave_channel", { channel_id: channel.id });
    };
  }, [channel.id]);

  // 새 메시지 시 스크롤 하단
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
      if (isNearBottom) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [channelMessages.length]);

  const loadMessages = async (before?: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const data = await messageApi.list(channel.id, before);
      if (before) {
        prependMessages(channel.id, data);
      } else {
        setMessages(channel.id, data);
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 50);
      }
      setHasMore(data.length === 50);
    } catch {
      toast.error("메시지 로딩에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || !hasMore || loading) return;
    if (el.scrollTop < 100 && channelMessages.length > 0) {
      loadMessages(channelMessages[0].id);
    }
  };

  const handleTyping = (isTyping: boolean) => {
    sendEvent(isTyping ? "typing_start" : "typing_stop", { channel_id: channel.id });
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const result = await messageApi.search(searchQuery, channel.id);
      setSearchResults(result.messages);
    } catch {
      toast.error("검색에 실패했습니다");
    }
  };

  const typingList = typingUsers[channel.id] || [];
  const channelIcon = channel.type === "private" ? <Lock size={16} /> : <Hash size={16} />;

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-col flex-1 min-w-0">
        {/* 채널 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">{channelIcon}</span>
            <h2 className="font-bold text-gray-900">{channel.name}</h2>
            {channel.description && (
              <span className="text-sm text-gray-500 border-l pl-2">{channel.description}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen((o) => !o)}
              className="p-2 rounded hover:bg-gray-100 text-gray-500"
            >
              <Search size={18} />
            </button>
          </div>
        </div>

        {/* 검색 바 */}
        {searchOpen && (
          <div className="px-4 py-2 border-b bg-gray-50">
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="메시지 검색..."
                className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button onClick={handleSearch} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700">
                검색
              </button>
              <button onClick={() => { setSearchOpen(false); setSearchResults([]); setSearchQuery(""); }} className="p-1.5 rounded hover:bg-gray-200">
                <X size={16} />
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                <p className="text-xs text-gray-500">{searchResults.length}개 결과</p>
                {searchResults.map((m) => (
                  <div key={m.id} className="bg-white border rounded-lg p-2 text-sm hover:bg-gray-50">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="font-medium text-xs">{m.user.display_name}</span>
                      <span className="text-gray-400 text-xs">
                        {format(new Date(m.created_at), "yyyy.MM.dd HH:mm")}
                      </span>
                    </div>
                    <p className="text-gray-700 truncate">{m.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 메시지 목록 */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto py-2"
          onScroll={handleScroll}
        >
          {loading && channelMessages.length === 0 && (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {hasMore && channelMessages.length > 0 && (
            <div className="flex justify-center py-2">
              <button
                onClick={() => loadMessages(channelMessages[0].id)}
                className="text-sm text-blue-600 hover:underline"
              >
                이전 메시지 더 보기
              </button>
            </div>
          )}

          {channelMessages.map((msg, i) => {
            const prev = channelMessages[i - 1];
            const showDate = !prev || !isSameDay(new Date(msg.created_at), new Date(prev.created_at));
            const showHeader = !prev || prev.user_id !== msg.user_id ||
              (new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()) > 5 * 60 * 1000;

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-500 font-medium">
                      {format(new Date(msg.created_at), "yyyy년 M월 d일 EEEE", { locale: ko })}
                    </span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}
                <MessageItem
                  message={msg}
                  showHeader={showHeader}
                  onThreadOpen={setThreadMessage}
                  onImagePreview={setLightboxSrc}
                />
              </div>
            );
          })}

          {/* 입력 중 표시 */}
          {typingList.length > 0 && (
            <div className="px-4 py-1">
              <span className="text-xs text-gray-500 italic">
                {typingList.length === 1 ? "누군가가 입력 중..." : `${typingList.length}명이 입력 중...`}
              </span>
            </div>
          )}
        </div>

        {/* 메시지 입력 */}
        <div className="shrink-0">
          <MessageInput
            channelId={channel.id}
            placeholder={`#${channel.name}에 메시지 보내기`}
            onTyping={handleTyping}
          />
        </div>
      </div>

      {/* 쓰레드 패널 */}
      {threadMessage && (
        <ThreadPanel
          parentMessage={threadMessage}
          channelId={channel.id}
          onClose={() => setThreadMessage(null)}
        />
      )}

      {/* 이미지 라이트박스 */}
      {lightboxSrc && (
        <Lightbox
          open
          close={() => setLightboxSrc(null)}
          slides={[{ src: lightboxSrc }]}
        />
      )}
    </div>
  );
}
