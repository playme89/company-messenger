import { useState } from "react";
import { format } from "date-fns";
import { Edit3, Trash2, MessageSquare, Smile, Download, Image } from "lucide-react";
import type { Message } from "@/types";
import { Avatar } from "@/components/common/Avatar";
import { messageApi } from "@/api/chat.api";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/utils/cn";
import { formatFileSize } from "@/utils/dateUtils";
import { toast } from "sonner";

const EMOJI_LIST = ["👍", "❤️", "😂", "😮", "😢", "🎉", "👀", "🔥"];

interface MessageItemProps {
  message: Message;
  showHeader: boolean;
  onThreadOpen: (message: Message) => void;
  onImagePreview: (url: string) => void;
}

export function MessageItem({ message, showHeader, onThreadOpen, onImagePreview }: MessageItemProps) {
  const { user: currentUser } = useAuthStore();
  const { updateMessage, deleteMessage } = useChatStore();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showEmoji, setShowEmoji] = useState(false);
  const [hovering, setHovering] = useState(false);

  const isOwn = currentUser?.id === message.user_id;

  const handleEdit = async () => {
    if (!editContent.trim() || editContent === message.content) {
      setEditing(false);
      return;
    }
    try {
      await messageApi.update(message.id, editContent);
      updateMessage(message.id, editContent);
      setEditing(false);
    } catch {
      toast.error("메시지 수정에 실패했습니다");
    }
  };

  const handleDelete = async () => {
    if (!confirm("메시지를 삭제하시겠습니까?")) return;
    try {
      await messageApi.delete(message.id);
      deleteMessage(message.id, message.channel_id);
    } catch {
      toast.error("메시지 삭제에 실패했습니다");
    }
  };

  const handleReaction = async (emoji: string) => {
    setShowEmoji(false);
    try {
      await messageApi.addReaction(message.id, emoji);
    } catch {
      toast.error("반응 추가에 실패했습니다");
    }
  };

  if (message.is_deleted) {
    return (
      <div className="px-4 py-1">
        <span className="text-sm text-gray-400 italic">삭제된 메시지입니다</span>
      </div>
    );
  }

  return (
    <div
      className="relative px-4 py-0.5 hover:bg-gray-50 group"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); setShowEmoji(false); }}
    >
      {/* 액션 버튼 (호버 시) */}
      {hovering && (
        <div className="absolute right-4 top-0 -translate-y-2 bg-white border border-gray-200 rounded-lg shadow-md flex items-center gap-0.5 p-0.5 z-10">
          <ActionBtn icon={<Smile size={14} />} onClick={() => setShowEmoji((o) => !o)} title="반응" />
          <ActionBtn icon={<MessageSquare size={14} />} onClick={() => onThreadOpen(message)} title="답글" />
          {isOwn && (
            <>
              <ActionBtn icon={<Edit3 size={14} />} onClick={() => { setEditing(true); setEditContent(message.content); }} title="수정" />
              <ActionBtn icon={<Trash2 size={14} />} onClick={handleDelete} title="삭제" className="text-red-500 hover:text-red-600" />
            </>
          )}
        </div>
      )}

      {/* 이모지 피커 */}
      {showEmoji && (
        <div className="absolute right-4 top-6 bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex gap-1.5 z-20">
          {EMOJI_LIST.map((e) => (
            <button key={e} onClick={() => handleReaction(e)} className="text-xl hover:scale-125 transition-transform">
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        {/* 아바타 */}
        <div className="w-9 shrink-0">
          {showHeader && <Avatar user={message.user} size="md" showPresence />}
        </div>

        <div className="flex-1 min-w-0">
          {/* 메시지 헤더 */}
          {showHeader && (
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="font-bold text-sm text-gray-900">{message.user.display_name}</span>
              <span className="text-xs text-gray-400">
                {format(new Date(message.created_at), "HH:mm")}
              </span>
              {message.is_edited && (
                <span className="text-xs text-gray-400">(수정됨)</span>
              )}
            </div>
          )}

          {/* 메시지 내용 */}
          {editing ? (
            <div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full border border-blue-400 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                rows={2}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEdit(); }
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <div className="flex gap-2 mt-1 text-xs">
                <button onClick={handleEdit} className="text-blue-600 hover:underline">저장</button>
                <button onClick={() => setEditing(false)} className="text-gray-500 hover:underline">취소</button>
              </div>
            </div>
          ) : (
            <p className={cn("text-sm text-gray-800 break-words whitespace-pre-wrap", !showHeader && "text-gray-700")}>
              {message.content}
            </p>
          )}

          {/* 파일 첨부 */}
          {message.files.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.files.map((f) => {
                const isImage = f.mime_type.startsWith("image/");
                const url = `/uploads/${f.storage_path}`;
                const thumbUrl = f.thumbnail_path ? `/uploads/${f.thumbnail_path}` : null;

                if (isImage) {
                  return (
                    <div key={f.id} className="inline-block">
                      <img
                        src={thumbUrl || url}
                        alt={f.file_name}
                        className="max-w-xs max-h-48 rounded-lg cursor-pointer object-cover border"
                        onClick={() => onImagePreview(url)}
                      />
                    </div>
                  );
                }

                return (
                  <a
                    key={f.id}
                    href={url}
                    download={f.file_name}
                    className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-sm hover:bg-gray-200 max-w-xs"
                  >
                    <Download size={16} className="text-gray-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-800">{f.file_name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(f.file_size)}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          )}

          {/* 반응 */}
          {message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {message.reactions.map((r) => (
                <button
                  key={r.emoji}
                  onClick={() => handleReaction(r.emoji)}
                  className="flex items-center gap-1 bg-gray-100 hover:bg-blue-50 border hover:border-blue-400 rounded-full px-2 py-0.5 text-xs"
                >
                  <span>{r.emoji}</span>
                  <span className="text-gray-600 font-medium">{r.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* 쓰레드 답글 수 */}
          {message.reply_count > 0 && (
            <button
              onClick={() => onThreadOpen(message)}
              className="mt-1 text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <MessageSquare size={12} />
              {message.reply_count}개 답글
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon, onClick, title, className = "" }: { icon: React.ReactNode; onClick: () => void; title: string; className?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn("p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800", className)}
    >
      {icon}
    </button>
  );
}
