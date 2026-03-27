import { apiClient } from "./client";
import type { ScheduleTask } from "@/types";

export const scheduleApi = {
  getTasks: (startDate: string, endDate: string, departmentId?: string, userId?: string) =>
    apiClient
      .get<ScheduleTask[]>("/schedule/tasks", {
        params: { start_date: startDate, end_date: endDate, department_id: departmentId, user_id: userId },
      })
      .then((r) => r.data),

  createTask: (data: {
    title: string;
    description?: string;
    start_date: string;
    end_date: string;
    color?: string;
    progress?: number;
    status?: string;
    parent_task_id?: string;
    order_index?: number;
  }) => apiClient.post<ScheduleTask>("/schedule/tasks", data).then((r) => r.data),

  updateTask: (id: string, data: Partial<{
    title: string;
    description: string;
    start_date: string;
    end_date: string;
    color: string;
    progress: number;
    status: string;
    order_index: number;
  }>) => apiClient.patch<ScheduleTask>(`/schedule/tasks/${id}`, data).then((r) => r.data),

  deleteTask: (id: string) => apiClient.delete(`/schedule/tasks/${id}`),
};
