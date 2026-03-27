import { apiClient } from "./client";
import type { User, Department } from "@/types";

export const usersApi = {
  list: (departmentId?: string) =>
    apiClient.get<User[]>("/users", { params: { department_id: departmentId } }).then((r) => r.data),

  get: (id: string) => apiClient.get<User>(`/users/${id}`).then((r) => r.data),

  updateMe: (data: { display_name?: string; avatar_url?: string; department_id?: string }) =>
    apiClient.patch<User>("/users/me", data).then((r) => r.data),

  getPresence: (userIds: string[]) =>
    apiClient
      .get<Record<string, "online" | "away" | "offline">>("/users/presence", {
        params: { user_ids: userIds.join(",") },
      })
      .then((r) => r.data),

  getDepartments: () =>
    apiClient.get<Department[]>("/users/departments/list").then((r) => r.data),

  createDepartment: (data: { name: string; parent_id?: string; order_index?: number }) =>
    apiClient.post<Department>("/users/departments", data).then((r) => r.data),
};
