import { apiClient } from "./client";
import type { User, TokenResponse } from "@/types";

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<TokenResponse>("/auth/login", { email, password }).then((r) => r.data),

  register: (data: { email: string; username: string; display_name: string; password: string; department_id?: string }) =>
    apiClient.post<User>("/auth/register", data).then((r) => r.data),

  me: () => apiClient.get<User>("/auth/me").then((r) => r.data),

  refresh: (refresh_token: string) =>
    apiClient.post<TokenResponse>("/auth/refresh", { refresh_token }).then((r) => r.data),
};
