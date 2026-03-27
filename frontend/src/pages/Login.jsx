import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Mail, Lock, User, AtSign, Eye, EyeOff, Loader } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const [tab, setTab] = useState('login')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()
  const navigate = useNavigate()

  // Login form state
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })

  // Register form state
  const [registerForm, setRegisterForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    username: '',
  })

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!loginForm.email || !loginForm.password) {
      toast.error('이메일과 비밀번호를 입력해주세요.')
      return
    }

    setLoading(true)
    const result = await login(loginForm.email, loginForm.password)
    setLoading(false)

    if (result.success) {
      toast.success('로그인되었습니다!')
      navigate('/')
    } else {
      const msg = result.error?.includes('Invalid login credentials')
        ? '이메일 또는 비밀번호가 올바르지 않습니다.'
        : result.error || '로그인에 실패했습니다.'
      toast.error(msg)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()

    if (!registerForm.email || !registerForm.password || !registerForm.fullName || !registerForm.username) {
      toast.error('모든 필드를 입력해주세요.')
      return
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error('비밀번호가 일치하지 않습니다.')
      return
    }

    if (registerForm.password.length < 6) {
      toast.error('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(registerForm.username)) {
      toast.error('사용자명은 3-20자의 영문, 숫자, 밑줄만 사용 가능합니다.')
      return
    }

    setLoading(true)
    const result = await register(
      registerForm.email,
      registerForm.password,
      registerForm.fullName,
      registerForm.username
    )
    setLoading(false)

    if (result.success) {
      if (result.data?.user?.identities?.length === 0) {
        toast.error('이미 사용 중인 이메일입니다.')
        return
      }
      toast.success('회원가입이 완료되었습니다! 이메일을 확인해주세요.')
      setTab('login')
      setLoginForm({ email: registerForm.email, password: '' })
    } else {
      const msg = result.error?.includes('already registered')
        ? '이미 사용 중인 이메일입니다.'
        : result.error || '회원가입에 실패했습니다.'
      toast.error(msg)
    }
  }

  return (
    <div className="min-h-screen bg-sidebar-bg flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-primary opacity-5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-primary opacity-5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-primary rounded-2xl mb-4 shadow-lg">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">사내 메신저</h1>
          <p className="text-sidebar-muted mt-1 text-sm">팀과 소통하세요</p>
        </div>

        {/* Card */}
        <div className="bg-[#222529] rounded-2xl shadow-2xl border border-sidebar-border overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-sidebar-border">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                tab === 'login'
                  ? 'text-white border-b-2 border-brand-primary -mb-px'
                  : 'text-sidebar-muted hover:text-sidebar-text'
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => setTab('register')}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                tab === 'register'
                  ? 'text-white border-b-2 border-brand-primary -mb-px'
                  : 'text-sidebar-muted hover:text-sidebar-text'
              }`}
            >
              회원가입
            </button>
          </div>

          <div className="p-8">
            {/* Login Form */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-sm font-medium text-sidebar-text mb-1.5">
                    이메일
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-muted" />
                    <input
                      type="email"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      placeholder="your@email.com"
                      className="w-full bg-sidebar-bg border border-sidebar-border rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-sidebar-muted text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-sidebar-text mb-1.5">
                    비밀번호
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-muted" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      placeholder="비밀번호를 입력하세요"
                      className="w-full bg-sidebar-bg border border-sidebar-border rounded-lg py-2.5 pl-10 pr-10 text-white placeholder-sidebar-muted text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-sidebar-muted hover:text-sidebar-text transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-primary hover:bg-brand-hover text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
                >
                  {loading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      로그인 중...
                    </>
                  ) : (
                    '로그인'
                  )}
                </button>
              </form>
            )}

            {/* Register Form */}
            {tab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-sidebar-text mb-1.5">
                      이름
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-muted" />
                      <input
                        type="text"
                        value={registerForm.fullName}
                        onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                        placeholder="홍길동"
                        className="w-full bg-sidebar-bg border border-sidebar-border rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-sidebar-muted text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-sidebar-text mb-1.5">
                      사용자명
                    </label>
                    <div className="relative">
                      <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-muted" />
                      <input
                        type="text"
                        value={registerForm.username}
                        onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value.toLowerCase() })}
                        placeholder="hong_gd"
                        className="w-full bg-sidebar-bg border border-sidebar-border rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-sidebar-muted text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-sidebar-text mb-1.5">
                    이메일
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-muted" />
                    <input
                      type="email"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      placeholder="your@email.com"
                      className="w-full bg-sidebar-bg border border-sidebar-border rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-sidebar-muted text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-sidebar-text mb-1.5">
                    비밀번호
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-muted" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      placeholder="6자 이상"
                      className="w-full bg-sidebar-bg border border-sidebar-border rounded-lg py-2.5 pl-10 pr-10 text-white placeholder-sidebar-muted text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-sidebar-muted hover:text-sidebar-text transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-sidebar-text mb-1.5">
                    비밀번호 확인
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-muted" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={registerForm.confirmPassword}
                      onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                      placeholder="비밀번호 재입력"
                      className="w-full bg-sidebar-bg border border-sidebar-border rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-sidebar-muted text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-primary hover:bg-brand-hover text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
                >
                  {loading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      가입 중...
                    </>
                  ) : (
                    '회원가입'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-sidebar-muted text-xs mt-6">
          © 2025 사내 메신저. All rights reserved.
        </p>
      </div>
    </div>
  )
}
