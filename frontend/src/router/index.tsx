import { createBrowserRouter, Navigate, useParams } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { ChatPage } from "@/pages/ChatPage";
import { SchedulePage } from "@/pages/SchedulePage";
import { MembersPage } from "@/pages/MembersPage";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function ChatWrapper() {
  const { channelId } = useParams<{ channelId: string }>();
  const channels = useChatStore((s) => s.channels);
  const channel = channels.find((c) => c.id === channelId);

  if (!channel) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p>채널을 선택해주세요</p>
      </div>
    );
  }

  return <ChatPage channel={channel} />;
}

function DefaultChat() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center text-gray-400">
        <p className="text-lg font-medium mb-2">채널을 선택해주세요</p>
        <p className="text-sm">좌측 채널 목록에서 채널을 선택하거나 새로 만드세요</p>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/chat" replace /> },
      { path: "chat", element: <DefaultChat /> },
      { path: "chat/:channelId", element: <ChatWrapper /> },
      { path: "schedule", element: <SchedulePage /> },
      { path: "members", element: <MembersPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
