export interface Department {
  id: string;
  name: string;
  parent_id: string | null;
  order_index: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  department_id: string | null;
  department: Department | null;
  role: "admin" | "member";
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  presence?: "online" | "away" | "offline";
}

export interface Channel {
  id: string;
  name: string;
  description: string | null;
  type: "public" | "private" | "dm";
  created_by: string;
  created_at: string;
  unread_count: number;
}

export interface ChannelMember {
  user_id: string;
  role: "owner" | "admin" | "member";
  last_read_at: string | null;
  joined_at: string;
  user: User;
}

export interface MessageFile {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  thumbnail_path: string | null;
}

export interface Reaction {
  emoji: string;
  user_id: string;
  count: number;
}

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  content_type: "text" | "image" | "file";
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  user: User;
  files: MessageFile[];
  reactions: Reaction[];
  reply_count: number;
}

export interface ScheduleTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  color: string;
  progress: number;
  status: "planned" | "in_progress" | "done" | "hold";
  parent_task_id: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
  user: User;
}

// WebSocket 이벤트
export type WSEventType =
  | "connected"
  | "pong"
  | "new_message"
  | "message_updated"
  | "message_deleted"
  | "new_reaction"
  | "user_typing"
  | "presence_update"
  | "channel_created"
  | "channel_member_added"
  | "schedule_updated"
  | "unread_count"
  | "error";

export interface WSEvent {
  type: WSEventType;
  payload: Record<string, unknown>;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
