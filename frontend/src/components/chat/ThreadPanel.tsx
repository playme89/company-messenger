import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Message } from "@/types";
import { MessageItem } from "./MessageItem";
import { MessageInput } from "./MessageInput";
import { messageApi } from "@/api/chat.api";
import { toast } from "sonner";

interface ThreadPanelProps {
  parentMessage: Message;
  channelId: string;
  onClose: () => void;
}

export function ThreadPanel({ parentMessage, channelId, onClose }: ThreadPanelProps) {
  const [replies, setReplies] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReplies = async () => {
    try {
      const data = await messageApi.getThreadReplies(channelId, parentMessage.id);
      setReplies(data);
    } catch {
      toast.error("답글 로딩에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReplies();
  }, [parentMessage.id]);

  return (
    <div className="w-80 border-l border-gray-200 flex flex-col bg-white animate-slide-in-right">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-gray-800">쓰레드</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
          <X size={18} />
        </button>
      </div>

      {/* 원본 메시지 */}
      <div className="px-4 py-3 border-b bg-gray-50">
        <MessageItem
          message={parentMessage}
          showHeader
          onThreadOpen={() => {}}
          onImagePreview={() => {}}
        />
      </div>

      <div className="text-xs text-gray-500 px-4 py-2 font-medium">
        {replies.length}개 답글
      </div>

      {/* 답글 목록 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          replies.map((reply, i) => (
            <MessageItem
              key={reply.id}
              message={reply}
              showHeader={i === 0 || replies[i - 1]?.user_id !== reply.user_id}
              onThreadOpen={() => {}}
              onImagePreview={() => {}}
            />
          ))
        )}
      </div>

      {/* 답글 입력 */}
      <MessageInput
        channelId={channelId}
        parentId={parentMessage.id}
        placeholder="답글 입력..."
        onSend={loadReplies}
      />
    </div>
  );
}
