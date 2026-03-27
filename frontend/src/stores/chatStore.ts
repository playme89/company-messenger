import { create } from "zustand";
import type { Channel, Message } from "@/types";

interface TypingUser {
  userId: string;
  channelId: string;
  timeout: ReturnType<typeof setTimeout>;
}

interface ChatState {
  channels: Channel[];
  activeChannelId: string | null;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, string[]>; // channelId -> userId[]
  threadMessageId: string | null; // 열린 쓰레드 메시지 ID

  setChannels: (channels: Channel[]) => void;
  addChannel: (channel: Channel) => void;
  updateChannelUnread: (channelId: string, count: number) => void;
  setActiveChannel: (channelId: string | null) => void;

  setMessages: (channelId: string, messages: Message[]) => void;
  prependMessages: (channelId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, content: string) => void;
  deleteMessage: (messageId: string, channelId: string) => void;
  addReaction: (messageId: string, channelId: string, emoji: string, userId: string) => void;

  setTyping: (channelId: string, userId: string, isTyping: boolean) => void;
  setThreadMessageId: (messageId: string | null) => void;
}

const typingTimers: Record<string, ReturnType<typeof setTimeout>> = {};

export const useChatStore = create<ChatState>((set, get) => ({
  channels: [],
  activeChannelId: null,
  messages: {},
  typingUsers: {},
  threadMessageId: null,

  setChannels: (channels) => set({ channels }),

  addChannel: (channel) =>
    set((s) => ({ channels: [...s.channels, channel] })),

  updateChannelUnread: (channelId, count) =>
    set((s) => ({
      channels: s.channels.map((ch) =>
        ch.id === channelId ? { ...ch, unread_count: count } : ch
      ),
    })),

  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),

  setMessages: (channelId, messages) =>
    set((s) => ({ messages: { ...s.messages, [channelId]: messages } })),

  prependMessages: (channelId, messages) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: [...messages, ...(s.messages[channelId] || [])],
      },
    })),

  addMessage: (message) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [message.channel_id]: [
          ...(s.messages[message.channel_id] || []),
          message,
        ],
      },
    })),

  updateMessage: (messageId, content) =>
    set((s) => {
      const newMessages = { ...s.messages };
      for (const channelId in newMessages) {
        newMessages[channelId] = newMessages[channelId].map((m) =>
          m.id === messageId ? { ...m, content, is_edited: true } : m
        );
      }
      return { messages: newMessages };
    }),

  deleteMessage: (messageId, channelId) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: (s.messages[channelId] || []).map((m) =>
          m.id === messageId
            ? { ...m, is_deleted: true, content: "삭제된 메시지입니다" }
            : m
        ),
      },
    })),

  addReaction: (messageId, channelId, emoji, userId) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: (s.messages[channelId] || []).map((m) => {
          if (m.id !== messageId) return m;
          const existing = m.reactions.find((r) => r.emoji === emoji);
          if (existing) {
            return {
              ...m,
              reactions: m.reactions.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count + 1 } : r
              ),
            };
          }
          return {
            ...m,
            reactions: [...m.reactions, { emoji, user_id: userId, count: 1 }],
          };
        }),
      },
    })),

  setTyping: (channelId, userId, isTyping) => {
    const key = `${channelId}:${userId}`;
    if (typingTimers[key]) {
      clearTimeout(typingTimers[key]);
      delete typingTimers[key];
    }
    if (isTyping) {
      typingTimers[key] = setTimeout(() => {
        get().setTyping(channelId, userId, false);
      }, 4000);
      set((s) => ({
        typingUsers: {
          ...s.typingUsers,
          [channelId]: [...new Set([...(s.typingUsers[channelId] || []), userId])],
        },
      }));
    } else {
      set((s) => ({
        typingUsers: {
          ...s.typingUsers,
          [channelId]: (s.typingUsers[channelId] || []).filter((id) => id !== userId),
        },
      }));
    }
  },

  setThreadMessageId: (messageId) => set({ threadMessageId: messageId }),
}));
