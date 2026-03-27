import { useState, useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { CalendarDays, MessageSquare, LogOut, Settings, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { ChannelList } from "@/components/chat/ChannelList";
import { Avatar } from "@/components/common/Avatar";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";
import { usePresenceStore } from "@/stores/presenceStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import { channelApi } from "@/api/chat.api";
import { usersApi } from "@/api/users.api";
import { authApi } from "@/api/auth.api";
import { cn } from "@/utils/cn";
import type { Channel } from "@/types";

type Tab = "chat" | "schedule";

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser, logout } = useAuthStore();
  const { channels, setChannels, setActiveChannel } = useChatStore();
  const { setMultiplePresence } = usePresenceStore();
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  // WebSocket 초기화 (앱 전체에서 1번만)
  useWebSocket();

  // 현재 사용자 정보 로드
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: authApi.me });
  useEffect(() => { if (me) setUser(me); }, [me]);

  // 채널 목록 로드
  const { data: channelData } = useQuery({
    queryKey: ["channels"],
    queryFn: channelApi.list,
    refetchInterval: 30000,
  });
  useEffect(() => { if (channelData) setChannels(channelData); }, [channelData]);

  // 전체 사용자 presence 로드
  const { data: allUsers } = useQuery({ queryKey: ["users"], queryFn: () => usersApi.list() });
  useEffect(() => {
    if (!allUsers) return;
    const ids = allUsers.map((u) => u.id);
    usersApi.getPresence(ids).then((p) => setMultiplePresence(p));
  }, [allUsers]);

  const handleChannelSelect = (channelId: string) => {
    setActiveChannel(channelId);
    navigate(`/chat/${channelId}`);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const currentChannelId = location.pathname.split("/chat/")[1];

  return (
    <div className="flex h-screen overflow-hidden bg-sidebar-bg">
      {/* 좌측 탭 네비게이션 */}
      <div className="w-14 flex flex-col items-center py-3 gap-1 border-r border-sidebar-border shrink-0">
        <button
          onClick={() => { setActiveTab("chat"); navigate(currentChannelId ? `/chat/${currentChannelId}` : "/chat"); }}
          className={cn(
            "p-3 rounded-xl text-sidebar-muted hover:text-sidebar-text hover:bg-sidebar-hover transition-colors",
            activeTab === "chat" && "bg-sidebar-active text-white"
          )}
          title="채팅"
        >
          <MessageSquare size={20} />
        </button>
        <button
          onClick={() => { setActiveTab("schedule"); navigate("/schedule"); }}
          className={cn(
            "p-3 rounded-xl text-sidebar-muted hover:text-sidebar-text hover:bg-sidebar-hover transition-colors",
            activeTab === "schedule" && "bg-sidebar-active text-white"
          )}
          title="일정표"
        >
          <CalendarDays size={20} />
        </button>
        <button
          onClick={() => navigate("/members")}
          className="p-3 rounded-xl text-sidebar-muted hover:text-sidebar-text hover:bg-sidebar-hover"
          title="멤버"
        >
          <Users size={20} />
        </button>

        <div className="flex-1" />

        <button onClick={handleLogout} className="p-3 rounded-xl text-sidebar-muted hover:text-red-400" title="로그아웃">
          <LogOut size={20} />
        </button>

        {user && (
          <div className="mb-2 mt-1">
            <Avatar user={user} size="md" showPresence />
          </div>
        )}
      </div>

      {/* 채널 사이드바 (채팅 탭일 때만) */}
      {activeTab === "chat" && (
        <div className="w-56 shrink-0 flex flex-col border-r border-sidebar-border overflow-hidden">
          <div className="px-4 py-3 border-b border-sidebar-border">
            <h1 className="text-white font-bold text-base">Company Messenger</h1>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ChannelList
              channels={channels}
              onChannelSelect={handleChannelSelect}
            />
          </div>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <div className="flex-1 bg-white overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
