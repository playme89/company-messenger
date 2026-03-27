import { create } from "zustand";

interface PresenceState {
  presence: Record<string, "online" | "away" | "offline">;
  setPresence: (userId: string, status: "online" | "away" | "offline") => void;
  setMultiplePresence: (presenceMap: Record<string, "online" | "away" | "offline">) => void;
  getStatus: (userId: string) => "online" | "away" | "offline";
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  presence: {},

  setPresence: (userId, status) =>
    set((s) => ({ presence: { ...s.presence, [userId]: status } })),

  setMultiplePresence: (presenceMap) =>
    set((s) => ({ presence: { ...s.presence, ...presenceMap } })),

  getStatus: (userId) => get().presence[userId] || "offline",
}));
