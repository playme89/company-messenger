import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { Avatar } from "@/components/common/Avatar";
import { usersApi } from "@/api/users.api";
import { channelApi } from "@/api/chat.api";
import { useChatStore } from "@/stores/chatStore";
import { usePresenceStore } from "@/stores/presenceStore";
import { cn } from "@/utils/cn";
import { toast } from "sonner";

const PRESENCE_LABELS = { online: "온라인", away: "자리 비움", offline: "오프라인" };

export function MembersPage() {
  const navigate = useNavigate();
  const { addChannel, setActiveChannel } = useChatStore();
  const { getStatus } = usePresenceStore();

  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => usersApi.list() });
  const { data: departments = [] } = useQuery({ queryKey: ["departments"], queryFn: usersApi.getDepartments });

  const grouped = departments.map((dept) => ({
    dept,
    members: users.filter((u) => u.department_id === dept.id),
  })).filter((g) => g.members.length > 0);

  const noDepMembers = users.filter((u) => !u.department_id);

  const handleDM = async (userId: string) => {
    try {
      const channel = await channelApi.createDm(userId);
      addChannel(channel);
      setActiveChannel(channel.id);
      navigate(`/chat/${channel.id}`);
    } catch {
      toast.error("DM 채널 생성에 실패했습니다");
    }
  };

  const MemberCard = ({ user }: { user: (typeof users)[0] }) => {
    const status = getStatus(user.id);
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 group">
        <Avatar user={user} size="lg" showPresence />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm">{user.display_name}</p>
          <p className="text-xs text-gray-500">@{user.username}</p>
          <p className={cn(
            "text-xs font-medium mt-0.5",
            status === "online" ? "text-green-600" : status === "away" ? "text-yellow-600" : "text-gray-400"
          )}>
            {PRESENCE_LABELS[status]}
          </p>
        </div>
        <button
          onClick={() => handleDM(user.id)}
          className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-blue-50 text-blue-600"
          title="DM 보내기"
        >
          <MessageSquare size={16} />
        </button>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">팀원 목록</h1>

      {grouped.map(({ dept, members }) => (
        <div key={dept.id} className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">{dept.name} — {members.length}명</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
            {members.map((u) => <MemberCard key={u.id} user={u} />)}
          </div>
        </div>
      ))}

      {noDepMembers.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">부서 없음 — {noDepMembers.length}명</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
            {noDepMembers.map((u) => <MemberCard key={u.id} user={u} />)}
          </div>
        </div>
      )}

      {users.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p>팀원이 없습니다</p>
        </div>
      )}
    </div>
  );
}
