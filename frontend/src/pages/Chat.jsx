import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Search, Bell, ChevronDown, LogOut, User, Settings, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePresence } from '../hooks/usePresence'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import ChatWindow from '../components/ChatWindow'
import SearchModal from '../components/SearchModal'
import NotificationPanel from '../components/NotificationPanel'
import AdminPanel from '../components/AdminPanel'
import toast from 'react-hot-toast'

export default function Chat() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user, profile, logout, isAdmin } = useAuth()

  const [activeRoom, setActiveRoom] = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [rooms, setRooms] = useState([])

  const { onlineUsers, isUserOnline } = usePresence(user?.id)

  // Fetch unread notification count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      setUnreadCount(count || 0)
    } catch (err) {
      console.error('Error fetching unread count:', err)
    }
  }, [user])

  useEffect(() => {
    fetchUnreadCount()
  }, [fetchUnreadCount])

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setUnreadCount(prev => prev + 1)

          // Browser notification
          if (Notification.permission === 'granted' && document.visibilityState !== 'visible') {
            fetchSenderName(payload.new.from_user_id).then(name => {
              new Notification('새 메시지', {
                body: `${name}님이 메시지를 보냈습니다.`,
                icon: '/favicon.svg',
              })
            })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchUnreadCount()
        }
      )
      .subscribe()

    // Request browser notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, fetchUnreadCount])

  // Set active room from URL
  useEffect(() => {
    if (roomId) {
      setActiveRoom(roomId)
    }
  }, [roomId])

  const fetchSenderName = async (senderId) => {
    if (!senderId) return '누군가'
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', senderId)
      .single()
    return data?.full_name || '누군가'
  }

  const handleSelectRoom = (room) => {
    setActiveRoom(room.id)
    navigate(`/room/${room.id}`)
  }

  const handleLogout = async () => {
    setShowProfileMenu(false)
    await logout()
    navigate('/login')
    toast.success('로그아웃되었습니다.')
  }

  const handleNotificationsClose = () => {
    setShowNotifications(false)
    fetchUnreadCount()
  }

  return (
    <div className="flex h-screen bg-sidebar-bg overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        activeRoomId={activeRoom}
        onSelectRoom={handleSelectRoom}
        onOpenAdmin={() => setShowAdminPanel(true)}
        isUserOnline={isUserOnline}
        rooms={rooms}
        setRooms={setRooms}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-14 bg-white border-b border-chat-border flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            {activeRoom && (
              <div className="text-sm text-gray-500">
                {/* Room info shown in ChatWindow header */}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Search button */}
            <button
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg px-3 py-1.5 text-sm transition-colors"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:block">검색</span>
              <kbd className="hidden sm:block text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                Ctrl+K
              </kbd>
            </button>

            {/* Notification bell */}
            <button
              onClick={() => setShowNotifications(true)}
              className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 unread-badge bg-red-500 text-white text-xs min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Profile menu */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-brand-primary flex items-center justify-center text-white text-xs font-semibold">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              </button>

              {showProfileMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProfileMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 animate-scale-in">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="font-semibold text-gray-900 text-sm">{profile?.full_name}</p>
                      <p className="text-xs text-gray-500">@{profile?.username}</p>
                      {isAdmin && (
                        <span className="inline-block mt-1 text-xs bg-brand-light text-brand-primary px-2 py-0.5 rounded-full font-medium">
                          관리자
                        </span>
                      )}
                    </div>

                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowProfileMenu(false)
                          // Profile editing could be added here
                          toast('프로필 편집 기능은 준비 중입니다.')
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <User className="w-4 h-4 text-gray-400" />
                        프로필 편집
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => {
                            setShowProfileMenu(false)
                            setShowAdminPanel(true)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Settings className="w-4 h-4 text-gray-400" />
                          관리자 패널
                        </button>
                      )}
                    </div>

                    <div className="py-1 border-t border-gray-100">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        로그아웃
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-hidden">
          {activeRoom ? (
            <ChatWindow
              roomId={activeRoom}
              currentUser={user}
              currentProfile={profile}
              isUserOnline={isUserOnline}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">대화를 선택하세요</h3>
                <p className="text-sm text-gray-500">왼쪽 사이드바에서 채팅방을 선택하거나 새 대화를 시작하세요.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard shortcut for search */}
      {typeof window !== 'undefined' && (() => {
        const handler = (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault()
            setShowSearch(true)
          }
        }
        window.addEventListener('keydown', handler)
        return null
      })()}

      {/* Modals */}
      {showSearch && (
        <SearchModal
          onClose={() => setShowSearch(false)}
          onSelectRoom={handleSelectRoom}
          currentUser={user}
        />
      )}

      {showNotifications && (
        <NotificationPanel
          onClose={handleNotificationsClose}
          currentUser={user}
          onSelectRoom={handleSelectRoom}
        />
      )}

      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}
    </div>
  )
}
