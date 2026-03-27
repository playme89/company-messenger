import { cn } from "@/utils/cn";
import type { User } from "@/types";
import { usePresenceStore } from "@/stores/presenceStore";

interface AvatarProps {
  user: User;
  size?: "sm" | "md" | "lg";
  showPresence?: boolean;
  className?: string;
}

const SIZES = {
  sm: "w-6 h-6 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-10 h-10 text-base",
};

const PRESENCE_COLORS = {
  online: "bg-green-500",
  away: "bg-yellow-500",
  offline: "bg-gray-400",
};

export function Avatar({ user, size = "md", showPresence = false, className }: AvatarProps) {
  const getStatus = usePresenceStore((s) => s.getStatus);
  const status = showPresence ? getStatus(user.id) : null;

  return (
    <div className={cn("relative shrink-0", className)}>
      {user.avatar_url ? (
        <img
          src={user.avatar_url}
          alt={user.display_name}
          className={cn("rounded-full object-cover", SIZES[size])}
        />
      ) : (
        <div
          className={cn(
            "rounded-full bg-blue-500 flex items-center justify-center text-white font-medium",
            SIZES[size]
          )}
        >
          {user.display_name[0].toUpperCase()}
        </div>
      )}
      {showPresence && status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white",
            PRESENCE_COLORS[status]
          )}
        />
      )}
    </div>
  );
}
