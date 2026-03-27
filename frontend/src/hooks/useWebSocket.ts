import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";
import { usePresenceStore } from "@/stores/presenceStore";
import { useScheduleStore } from "@/stores/scheduleStore";
import type { WSEvent, Message, ScheduleTask } from "@/types";

const WS_URL = import.meta.env.VITE_WS_URL || "";
const PING_INTERVAL = 30000;
const RECONNECT_DELAY = 3000;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const { accessToken } = useAuthStore();
  const { addMessage, updateMessage, deleteMessage, addReaction, setTyping, setChannels, channels } = useChatStore();
  const { setPresence } = usePresenceStore();
  const { updateTask } = useScheduleStore();

  const handleEvent = useCallback((event: WSEvent) => {
    switch (event.type) {
      case "new_message":
        addMessage(event.payload as unknown as Message);
        break;

      case "message_updated": {
        const { message_id, content } = event.payload as { message_id: string; content: string };
        updateMessage(message_id, content);
        break;
      }

      case "message_deleted": {
        const { message_id, channel_id } = event.payload as { message_id: string; channel_id: string };
        deleteMessage(message_id, channel_id);
        break;
      }

      case "new_reaction": {
        const { message_id, emoji, user_id } = event.payload as { message_id: string; emoji: string; user_id: string };
        // channel_id를 찾아서 addReaction 호출
        const { messages } = useChatStore.getState();
        for (const channelId in messages) {
          const found = messages[channelId].find((m) => m.id === message_id);
          if (found) {
            addReaction(message_id, channelId, emoji, user_id);
            break;
          }
        }
        break;
      }

      case "user_typing": {
        const { channel_id, user_id, is_typing } = event.payload as {
          channel_id: string;
          user_id: string;
          is_typing: boolean;
        };
        setTyping(channel_id, user_id, is_typing);
        break;
      }

      case "presence_update": {
        const { user_id, status } = event.payload as { user_id: string; status: "online" | "away" | "offline" };
        setPresence(user_id, status);
        break;
      }

      case "schedule_updated":
        updateTask(event.payload as unknown as ScheduleTask);
        break;
    }
  }, [addMessage, updateMessage, deleteMessage, addReaction, setTyping, setPresence, updateTask]);

  const connect = useCallback(() => {
    if (!accessToken || !mountedRef.current) return;

    const ws = new WebSocket(`${WS_URL}/ws?token=${accessToken}`);
    wsRef.current = ws;

    ws.onopen = () => {
      // 현재 채널들 구독
      const { activeChannelId } = useChatStore.getState();
      if (activeChannelId) {
        ws.send(JSON.stringify({ type: "join_channel", payload: { channel_id: activeChannelId } }));
      }

      // ping 시작
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping", payload: { timestamp: Date.now() } }));
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = (e) => {
      try {
        const event: WSEvent = JSON.parse(e.data);
        handleEvent(event);
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      if (mountedRef.current) {
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY);
      }
    };

    ws.onerror = () => ws.close();
  }, [accessToken, handleEvent]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendEvent = useCallback((type: string, payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  return { sendEvent, ws: wsRef.current };
}
