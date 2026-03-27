import { useState } from "react";
import { Hash, Lock, MessageSquare, Plus, Search, ChevronDown, ChevronRight } from "lucide-react";
import type { Channel } from "@/types";
import { cn } from "@/utils/cn";
import { useChatStore } from "@/stores/chatStore";
import { channelApi } from "@/api/chat.api";
import { toast } from "sonner";

interface ChannelListProps {
  channels: Channel[];
  onChannelSelect: (channelId: string) => void;
}

interface CreateChannelModalProps {
  onClose: () => void;
  onCreated: (channel: Channel) => void;
}

function CreateChannelModal({ onClose, onCreated }: CreateChannelModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"public" | "private">("public");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const channel = await channelApi.create({ name: name.trim(), description, type });
      onCreated(channel);
      onClose();
      toast.success(`#${channel.name} 채널이 생성되었습니다`);
    } catch {
      toast.error("채널 생성에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="p-5">
          <h2 className="text-lg font-bold mb-4">새 채널 만들기</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">채널 이름</label>
              <div className="flex items-center border rounded-lg px-3 focus-within:ring-2 focus-within:ring-blue-500">
                <Hash size={16} className="text-gray-400 shrink-0" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s/g, "-"))}
                  className="flex-1 py-2 px-2 text-sm outline-none"
                  placeholder="채널명"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">설명 (선택)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="채널 설명"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">채널 유형</label>
              <div className="flex gap-3">
                {(["public", "private"] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={type === t}
                      onChange={() => setType(t)}
                      className="accent-blue-600"
                    />
                    <span className="text-sm">{t === "public" ? "공개" : "비공개"}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">
                취소
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "생성 중..." : "만들기"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export function ChannelList({ channels, onChannelSelect }: ChannelListProps) {
  const { activeChannelId, addChannel } = useChatStore();
  const [showCreate, setShowCreate] = useState(false);
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);

  const publicChannels = channels.filter((c) => c.type !== "dm");
  const dmChannels = channels.filter((c) => c.type === "dm");

  const ChannelItem = ({ channel }: { channel: Channel }) => {
    const isActive = activeChannelId === channel.id;
    const Icon = channel.type === "private" ? Lock : channel.type === "dm" ? MessageSquare : Hash;

    return (
      <button
        onClick={() => onChannelSelect(channel.id)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm text-sidebar-text hover:bg-sidebar-hover group",
          isActive && "bg-sidebar-active text-white"
        )}
      >
        <Icon size={16} className="shrink-0" />
        <span className="truncate flex-1 text-left">{channel.name}</span>
        {channel.unread_count > 0 && (
          <span className={cn(
            "text-xs font-bold px-1.5 py-0.5 rounded-full",
            isActive ? "bg-white/20 text-white" : "bg-white text-sidebar-active"
          )}>
            {channel.unread_count > 99 ? "99+" : channel.unread_count}
          </span>
        )}
      </button>
    );
  };

  const SectionHeader = ({
    label, open, onToggle, onAdd,
  }: { label: string; open: boolean; onToggle: () => void; onAdd?: () => void }) => (
    <div className="flex items-center px-2 py-1 group">
      <button onClick={onToggle} className="flex-1 flex items-center gap-1 text-sidebar-muted text-xs font-semibold uppercase hover:text-sidebar-text">
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {label}
      </button>
      {onAdd && (
        <button onClick={onAdd} className="p-0.5 rounded hover:bg-sidebar-hover opacity-0 group-hover:opacity-100 text-sidebar-muted hover:text-sidebar-text">
          <Plus size={14} />
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col py-2 overflow-y-auto">
      {/* 채널 섹션 */}
      <SectionHeader
        label="채널"
        open={channelsOpen}
        onToggle={() => setChannelsOpen((o) => !o)}
        onAdd={() => setShowCreate(true)}
      />
      {channelsOpen && (
        <div className="space-y-0.5 px-1 mb-3">
          {publicChannels.map((ch) => <ChannelItem key={ch.id} channel={ch} />)}
          {publicChannels.length === 0 && (
            <p className="text-sidebar-muted text-xs px-3 py-1">채널이 없습니다</p>
          )}
        </div>
      )}

      {/* DM 섹션 */}
      <SectionHeader
        label="다이렉트 메시지"
        open={dmsOpen}
        onToggle={() => setDmsOpen((o) => !o)}
      />
      {dmsOpen && (
        <div className="space-y-0.5 px-1">
          {dmChannels.map((ch) => <ChannelItem key={ch.id} channel={ch} />)}
          {dmChannels.length === 0 && (
            <p className="text-sidebar-muted text-xs px-3 py-1">DM이 없습니다</p>
          )}
        </div>
      )}

      {showCreate && (
        <CreateChannelModal
          onClose={() => setShowCreate(false)}
          onCreated={(ch) => addChannel(ch)}
        />
      )}
    </div>
  );
}
