import { apiClient } from "./client";
import type { Channel, ChannelMember, Message, MessageSearchResult } from "@/types";

export const channelApi = {
  list: () => apiClient.get<Channel[]>("/channels").then((r) => r.data),
  create: (data: { name: string; description?: string; type?: string; member_ids?: string[] }) =>
    apiClient.post<Channel>("/channels", data).then((r) => r.data),
  get: (id: string) => apiClient.get<Channel>(`/channels/${id}`).then((r) => r.data),
  update: (id: string, data: { name?: string; description?: string }) =>
    apiClient.patch<Channel>(`/channels/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/channels/${id}`),
  getMembers: (id: string) => apiClient.get<ChannelMember[]>(`/channels/${id}/members`).then((r) => r.data),
  addMember: (channelId: string, userId: string) =>
    apiClient.post(`/channels/${channelId}/members/${userId}`),
  removeMember: (channelId: string, userId: string) =>
    apiClient.delete(`/channels/${channelId}/members/${userId}`),
  markRead: (id: string) => apiClient.post(`/channels/${id}/read`),
  createDm: (targetUserId: string) =>
    apiClient.post<Channel>("/channels/dm", { target_user_id: targetUserId }).then((r) => r.data),
};

export const messageApi = {
  list: (channelId: string, before?: string) =>
    apiClient
      .get<Message[]>(`/messages/channels/${channelId}/messages`, {
        params: before ? { before } : undefined,
      })
      .then((r) => r.data),

  send: (channelId: string, data: { content: string; parent_id?: string; file_ids?: string[] }) =>
    apiClient.post<Message>(`/messages/channels/${channelId}/messages`, data).then((r) => r.data),

  update: (messageId: string, content: string) =>
    apiClient.patch<Message>(`/messages/messages/${messageId}`, { content }).then((r) => r.data),

  delete: (messageId: string) => apiClient.delete(`/messages/messages/${messageId}`),

  getThreadReplies: (channelId: string, messageId: string) =>
    apiClient.get<Message[]>(`/messages/channels/${channelId}/threads/${messageId}`).then((r) => r.data),

  addReaction: (messageId: string, emoji: string) =>
    apiClient.post(`/messages/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`),

  removeReaction: (messageId: string, emoji: string) =>
    apiClient.delete(`/messages/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`),

  search: (q: string, channelId?: string, limit = 20, offset = 0) =>
    apiClient
      .get<MessageSearchResult>("/messages/messages/search", {
        params: { q, channel_id: channelId, limit, offset },
      })
      .then((r) => r.data),
};

export const uploadApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient
      .post<{
        file_id: string;
        file_name: string;
        file_size: number;
        mime_type: string;
        url: string;
        thumbnail_url: string | null;
      }>("/upload/file", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};
