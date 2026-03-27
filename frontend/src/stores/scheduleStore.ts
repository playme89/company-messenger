import { create } from "zustand";
import type { ScheduleTask } from "@/types";
import { addMonths, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { dateToStr } from "@/utils/dateUtils";

interface ScheduleState {
  tasks: ScheduleTask[];
  viewStart: Date;
  viewEnd: Date;
  selectedDepartmentId: string | null;
  selectedTaskId: string | null;

  setTasks: (tasks: ScheduleTask[]) => void;
  addTask: (task: ScheduleTask) => void;
  updateTask: (task: ScheduleTask) => void;
  deleteTask: (taskId: string) => void;

  setViewStart: (date: Date) => void;
  setViewEnd: (date: Date) => void;
  navigateMonth: (direction: "prev" | "next") => void;

  setSelectedDepartmentId: (id: string | null) => void;
  setSelectedTaskId: (id: string | null) => void;
}

const today = new Date();

export const useScheduleStore = create<ScheduleState>((set) => ({
  tasks: [],
  viewStart: startOfMonth(today),
  viewEnd: endOfMonth(addMonths(today, 2)),
  selectedDepartmentId: null,
  selectedTaskId: null,

  setTasks: (tasks) => set({ tasks }),

  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),

  updateTask: (task) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === task.id ? task : t)),
    })),

  deleteTask: (taskId) =>
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) })),

  setViewStart: (date) => set({ viewStart: date }),
  setViewEnd: (date) => set({ viewEnd: date }),

  navigateMonth: (direction) =>
    set((s) => {
      const fn = direction === "next" ? addMonths : subMonths;
      return {
        viewStart: fn(s.viewStart, 1),
        viewEnd: fn(s.viewEnd, 1),
      };
    }),

  setSelectedDepartmentId: (id) => set({ selectedDepartmentId: id }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
}));
