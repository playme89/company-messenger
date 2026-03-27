import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch profile data
  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data)
      return data
    } catch (err) {
      console.error('Error fetching profile:', err)
      return null
    }
  }, [])

  // Set online status
  const setOnlineStatus = useCallback(async (userId, isOnline) => {
    try {
      await supabase
        .from('profiles')
        .update({
          is_online: isOnline,
          last_seen: new Date().toISOString(),
        })
        .eq('id', userId)
    } catch (err) {
      console.error('Error updating online status:', err)
    }
  }, [])

  // Initialize auth state
  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user && mounted) {
          setUser(session.user)
          await fetchProfile(session.user.id)
          await setOnlineStatus(session.user.id, true)
        }
      } catch (err) {
        console.error('Auth init error:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          await fetchProfile(session.user.id)
          await setOnlineStatus(session.user.id, true)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile, setOnlineStatus])

  // Track page visibility for online status
  useEffect(() => {
    if (!user) return

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        await setOnlineStatus(user.id, true)
        setProfile(prev => prev ? { ...prev, is_online: true } : prev)
      } else {
        await setOnlineStatus(user.id, false)
        setProfile(prev => prev ? { ...prev, is_online: false } : prev)
      }
    }

    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable offline marking
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`
      const data = JSON.stringify({ is_online: false, last_seen: new Date().toISOString() })
      navigator.sendBeacon(url, data)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [user, setOnlineStatus])

  // Login function
  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      return { success: true, data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  // Register function
  const register = async (email, password, fullName, username) => {
    try {
      // Check username availability
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single()

      if (existingUser) {
        return { success: false, error: '이미 사용 중인 사용자명입니다.' }
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            username: username,
          },
        },
      })

      if (error) throw error

      return { success: true, data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  // Logout function
  const logout = async () => {
    try {
      if (user) {
        await setOnlineStatus(user.id, false)
      }
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (err) {
      console.error('Logout error:', err)
      toast.error('로그아웃 중 오류가 발생했습니다.')
    }
  }

  // Update profile function
  const updateProfile = async (updates) => {
    try {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error

      setProfile(data)
      return { success: true, data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  // Toggle online status manually
  const toggleOnlineStatus = async () => {
    if (!user || !profile) return

    const newStatus = !profile.is_online
    const result = await updateProfile({ is_online: newStatus })
    if (!result.success) {
      toast.error('상태 변경에 실패했습니다.')
    }
  }

  // Refresh profile
  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }, [user, fetchProfile])

  const value = {
    user,
    profile,
    loading,
    login,
    logout,
    register,
    updateProfile,
    toggleOnlineStatus,
    refreshProfile,
    isAdmin: profile?.role === 'admin',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
