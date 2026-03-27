import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MessageSquare } from "lucide-react";
import { authApi } from "@/api/auth.api";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("올바른 이메일 형식을 입력해주세요"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});

const registerSchema = z.object({
  email: z.string().email("올바른 이메일 형식을 입력해주세요"),
  username: z.string().min(2, "2자 이상 입력해주세요").max(20, "20자 이하로 입력해주세요"),
  display_name: z.string().min(1, "이름을 입력해주세요"),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다"),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const handleLogin = async (data: LoginForm) => {
    try {
      const tokens = await authApi.login(data.email, data.password);
      const user = await authApi.me();
      setAuth(user, tokens.access_token, tokens.refresh_token);
      navigate("/chat");
    } catch {
      toast.error("이메일 또는 비밀번호가 올바르지 않습니다");
    }
  };

  const handleRegister = async (data: RegisterForm) => {
    try {
      await authApi.register(data);
      toast.success("계정이 생성되었습니다. 로그인해주세요");
      setIsRegister(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "회원가입에 실패했습니다");
    }
  };

  return (
    <div className="min-h-screen bg-sidebar-bg flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-brand-primary rounded-xl flex items-center justify-center mb-3">
            <MessageSquare size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Company Messenger</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isRegister ? "새 계정 만들기" : "로그인해서 시작하세요"}
          </p>
        </div>

        {!isRegister ? (
          <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                {...loginForm.register("email")}
                type="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                placeholder="이메일 입력"
                autoComplete="email"
              />
              {loginForm.formState.errors.email && (
                <p className="text-red-500 text-xs mt-1">{loginForm.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input
                {...loginForm.register("password")}
                type="password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                placeholder="비밀번호 입력"
                autoComplete="current-password"
              />
              {loginForm.formState.errors.password && (
                <p className="text-red-500 text-xs mt-1">{loginForm.formState.errors.password.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loginForm.formState.isSubmitting}
              className="w-full bg-brand-primary text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-brand-hover disabled:opacity-50 transition-colors"
            >
              {loginForm.formState.isSubmitting ? "로그인 중..." : "로그인"}
            </button>
          </form>
        ) : (
          <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                {...registerForm.register("email")}
                type="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                placeholder="이메일 입력"
              />
              {registerForm.formState.errors.email && (
                <p className="text-red-500 text-xs mt-1">{registerForm.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">사용자명</label>
              <input
                {...registerForm.register("username")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                placeholder="영문/숫자/언더스코어"
              />
              {registerForm.formState.errors.username && (
                <p className="text-red-500 text-xs mt-1">{registerForm.formState.errors.username.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
              <input
                {...registerForm.register("display_name")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input
                {...registerForm.register("password")}
                type="password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                placeholder="6자 이상"
              />
              {registerForm.formState.errors.password && (
                <p className="text-red-500 text-xs mt-1">{registerForm.formState.errors.password.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={registerForm.formState.isSubmitting}
              className="w-full bg-brand-primary text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-brand-hover disabled:opacity-50 transition-colors"
            >
              {registerForm.formState.isSubmitting ? "가입 중..." : "회원가입"}
            </button>
          </form>
        )}

        <div className="mt-5 text-center">
          <button
            onClick={() => setIsRegister((o) => !o)}
            className="text-sm text-brand-primary hover:underline"
          >
            {isRegister ? "이미 계정이 있으신가요? 로그인" : "계정이 없으신가요? 회원가입"}
          </button>
        </div>
      </div>
    </div>
  );
}
