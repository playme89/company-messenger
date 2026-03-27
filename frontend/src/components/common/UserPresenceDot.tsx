import { cn } from "@/utils/cn";
import { usePresenceStore } from "@/stores/presenceStore";

interface UserPresenceDotProps {
  userId: string;
  className?: string;
}

const STATUS_COLORS = {
  online: "bg-green-500",
  away: "bg-yellow-400",
  offline: "bg-gray-400",
};

export function UserPresenceDot({ userId, className }: UserPresenceDotProps) {
  const getStatus = usePresenceStore((s) => s.getStatus);
  const status = getStatus(userId);

  return (
    <span
      className={cn("inline-block w-2.5 h-2.5 rounded-full border-2 border-white", STATUS_COLORS[status], className)}
      title={status === "online" ? "온라인" : status === "away" ? "자리 비움" : "오프라인"}
    />
  );
}
