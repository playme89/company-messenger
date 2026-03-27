import React, { useState, useEffect, useCallback } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { X, Bell, BellOff, Check, CheckCheck, MessageSquare, Loader } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

function NotificationItem({ notification, onRead, onNavigate }) {
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: ko,
  })

  const getTypeLabel = () => {
    switch (notification.type) {
      case 'message': return '메시지를 보냈습니다'
      case 'mention': return '님이 언급했습니다'
      case 'room_invite': return '채널에 초대했습니다'
      default: return '알림'
    }
  }

  return (
    <div
      className={`flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 ${
        !notification.is_read ? 'bg-blue-50/50' : ''
      }`}
      onClick={() => onNavigate(notification)}
    >
      {/* Sender avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center text-white text-sm font-semibold">
          {notification.from_profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        {!notification.is_read && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 leading-snug">
          <span className="font-semibold">
            {notification.from_profile?.full_name || '알 수 없음'}
          </span>
          님이{' '}
          <span className="text-gray-600">{getTypeLabel()}</span>
        </p>
        {notification.message_content && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2 bg-gray-100 rounded px-2 py-1">
            {notification.message_content}
          </p>
        )}
        <p className="text-xs text-gray-400 mt-1">{timeAgo}</p>
      </div>

      {/* Mark as read button */}
      {!notification.is_read && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRead(notification.id)
          }}
          className="flex-shrink-0 p-1.5 text-gray-400 hover:text-brand-primary hover:bg-brand-light rounded-lg transition-colors"
          title="읽음으로 표시"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

export default function NotificationPanel({ onClose, currentUser, onSelectRoom }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  const fetchNotifications = useCallback(async () => {
    if (!currentUser) return
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id, user_id, from_user_id, room_id, message_id, type, is_read, created_at
        `)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      // Fetch sender profiles and message content
      const enriched = await Promise.all(
        (data || []).map(async (notif) => {
          let fromProfile = null
          let messageContent = null

          if (notif.from_user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, full_name, username, avatar_url')
              .eq('id', notif.from_user_id)
              .single()
            fromProfile = profile
          }

          if (notif.message_id) {
            const { data: msg } = await supabase
              .from('messages')
              .select('content')
              .eq('id', notif.message_id)
              .single()
            messageContent = msg?.content
          }

          return { ...notif, from_profile: fromProfile, message_content: messageContent }
        })
      )

      setNotifications(enriched)
    } catch (err) {
      console.error('Error fetching notifications:', err)
      toast.error('알림을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [currentUser])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Real-time subscription
  useEffect(() => {
    if (!currentUser) return

    const channel = supabase
      .channel(`notification-panel:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`,
        },
        async (payload) => {
          // Fetch full notification
          let fromProfile = null
          let messageContent = null

          if (payload.new.from_user_id) {
            const { data } = await supabase
              .from('profiles')
              .select('id, full_name, username, avatar_url')
              .eq('id', payload.new.from_user_id)
              .single()
            fromProfile = data
          }

          if (payload.new.message_id) {
            const { data } = await supabase
              .from('messages')
              .select('content')
              .eq('id', payload.new.message_id)
              .single()
            messageContent = data?.content
          }

          setNotifications(prev => [
            { ...payload.new, from_profile: fromProfile, message_content: messageContent },
            ...prev,
          ])
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [currentUser])

  const handleMarkAsRead = async (notifId) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notifId)

      setNotifications(prev =>
        prev.map(n => n.id === notifId ? { ...n, is_read: true } : n)
      )
    } catch (err) {
      toast.error('읽음 처리에 실패했습니다.')
    }
  }

  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter(n => !n.is_read)
    if (!unread.length) return

    setMarkingAll(true)
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentUser.id)
        .eq('is_read', false)

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      toast.success('모든 알림을 읽음으로 표시했습니다.')
    } catch (err) {
      toast.error('읽음 처리에 실패했습니다.')
    } finally {
      setMarkingAll(false)
    }
  }

  const handleNavigate = (notif) => {
    if (notif.room_id) {
      onSelectRoom({ id: notif.room_id })
      if (!notif.is_read) {
        handleMarkAsRead(notif.id)
      }
      onClose()
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="w-5 h-5 text-gray-700" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">알림</h2>
              {unreadCount > 0 && (
                <p className="text-xs text-gray-500">읽지 않은 알림 {unreadCount}개</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={markingAll}
                className="flex items-center gap-1.5 text-xs text-brand-primary hover:text-brand-hover font-medium px-2 py-1.5 hover:bg-brand-light rounded-lg transition-colors disabled:opacity-50"
              >
                {markingAll ? (
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="w-3.5 h-3.5" />
                )}
                모두 읽음
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto scrollbar-light">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader className="w-6 h-6 animate-spin text-gray-300" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 px-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <BellOff className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium">알림이 없습니다</p>
              <p className="text-gray-400 text-xs mt-1 text-center">
                새 메시지가 오면 여기에 표시됩니다
              </p>
            </div>
          ) : (
            <div>
              {unreadCount > 0 && (
                <div className="px-4 py-2 bg-blue-50/50 border-b border-blue-100">
                  <p className="text-xs font-semibold text-blue-600">읽지 않은 알림</p>
                </div>
              )}
              {notifications.map(notif => (
                <NotificationItem
                  key={notif.id}
                  notification={notif}
                  onRead={handleMarkAsRead}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400 text-center">
            최근 알림 {notifications.length}개
          </p>
        </div>
      </div>
    </>
  )
}
