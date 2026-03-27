import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Paperclip, X, Image } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { uploadApi, messageApi } from "@/api/chat.api";
import { formatFileSize } from "@/utils/dateUtils";
import { toast } from "sonner";

interface UploadedFile {
  file_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  url: string;
  thumbnail_url: string | null;
}

interface MessageInputProps {
  channelId: string;
  parentId?: string;
  placeholder?: string;
  onSend?: () => void;
  onTyping?: (isTyping: boolean) => void;
}

export function MessageInput({ channelId, parentId, placeholder, onSend, onTyping }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTyping = useCallback(() => {
    onTyping?.(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => onTyping?.(false), 2000);
  }, [onTyping]);

  const handleFileUpload = async (acceptedFiles: File[]) => {
    setUploading(true);
    try {
      const uploaded = await Promise.all(acceptedFiles.map((f) => uploadApi.upload(f)));
      setFiles((prev) => [...prev, ...uploaded]);
    } catch {
      toast.error("파일 업로드에 실패했습니다");
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: handleFileUpload,
    noClick: true,
    noKeyboard: true,
  });

  const handleSend = async () => {
    if ((!content.trim() && files.length === 0) || sending) return;
    setSending(true);
    try {
      await messageApi.send(channelId, {
        content: content.trim() || " ",
        parent_id: parentId,
        file_ids: files.map((f) => f.file_id),
      });
      setContent("");
      setFiles([]);
      onTyping?.(false);
      onSend?.();
    } catch {
      toast.error("메시지 전송에 실패했습니다");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 텍스트에리아 자동 높이 조절
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [content]);

  return (
    <div {...getRootProps()} className="relative">
      <input {...getInputProps()} />

      {isDragActive && (
        <div className="absolute inset-0 bg-blue-50 border-2 border-blue-400 border-dashed rounded-lg flex items-center justify-center z-10">
          <p className="text-blue-600 font-medium">파일을 여기에 놓으세요</p>
        </div>
      )}

      {/* 첨부 파일 미리보기 */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-3">
          {files.map((f) => {
            const isImage = f.mime_type.startsWith("image/");
            return (
              <div key={f.file_id} className="relative group">
                {isImage && f.thumbnail_url ? (
                  <img src={f.thumbnail_url} alt={f.file_name} className="w-20 h-20 object-cover rounded-lg border" />
                ) : (
                  <div className="w-20 h-20 bg-gray-100 rounded-lg border flex flex-col items-center justify-center p-2">
                    <Paperclip size={20} className="text-gray-400" />
                    <span className="text-xs text-gray-500 truncate w-full text-center mt-1">{f.file_name}</span>
                    <span className="text-xs text-gray-400">{formatFileSize(f.file_size)}</span>
                  </div>
                )}
                <button
                  onClick={() => setFiles((prev) => prev.filter((x) => x.file_id !== f.file_id))}
                  className="absolute -top-1.5 -right-1.5 bg-gray-700 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100"
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-end gap-2 p-3 bg-white border border-gray-300 rounded-xl mx-3 mb-3 shadow-sm">
        {/* 파일 첨부 버튼 */}
        <button
          onClick={open}
          disabled={uploading}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 shrink-0"
        >
          {uploading ? (
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Paperclip size={20} />
          )}
        </button>

        {/* 텍스트 입력 */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => { setContent(e.target.value); handleTyping(); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "메시지 입력... (Shift+Enter: 줄바꿈)"}
          className="flex-1 text-sm outline-none resize-none max-h-48 bg-transparent"
          rows={1}
        />

        {/* 전송 버튼 */}
        <button
          onClick={handleSend}
          disabled={(!content.trim() && files.length === 0) || sending}
          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
