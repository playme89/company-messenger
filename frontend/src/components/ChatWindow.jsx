import React, { useState, useEffect, useRef, useCallback } from 'react'
import { format, isToday, isYesterday, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Hash, Users, ChevronUp, Loader } from 'lucide-react'
import { supabase } from '../lib/supabase'
import MessageBubble from './MessageBubble'
import MessageInput from './MessageInput'

const MESSAGES_PER_PAGE = 50

function DateSeparator({ date }) {
  const dateObj = new Date(date)
  let label
  if (isToday(dateObj)) label = '오늘'
  else if (isYesterday(dateObj)) label = '어제'
  else label = format(dateObj, 'yyyy년 M월 d일 (EEEE)', { locale: ko })

  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs text-gray-400 font-medium px-2 whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}

export default function ChatWindow({ roomId, currentUser, currentProfile, isUserOnline }) {
  const [room, setRoom] = useState(null)
  const [members, setMembers] = useState([])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [readCounts, setReadCounts] = useState({})

  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const channelRef = useRef(null)
  const isAtBottomRef = useRef(true)

  // Fetch room info
  const fetchRoom = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single()

      if (error) throw error
      setRoom(data)

      // Fetch members
      const { data: memberData } = await supabase
        .from('room_members')
        .select('user_id, profiles(id, full_name, username, avatar_url, is_online)')
        .eq('room_id', roomId)

      setMembers(memberData?.map(m => m.profiles).filter(Boolean) || [])
    } catch (err) {
      console.error('Error fetching room:', err)
    }
  }, [roomId])

  // Fetch messages
  const fetchMessages = useCallback(async (before = null) => {
    try {
      let query = supabase
        .from('messages')
        .select(`
          id, room_id, sender_id, content, file_url, file_name, file_type,
          is_deleted, created_at,
          profiles:sender_id (id, full_name, username, avatar_url)
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PER_PAGE + 1)

      if (before) {
        query = query.lt('created_at', before)
      }

      const { data, error } = await query
      if (error) throw error

      const msgs = data || []
      const hasMoreData = msgs.length > MESSAGES_PER_PAGE

      return {
        messages: msgs.slice(0, MESSAGES_PER_PAGE).reverse(),
        hasMore: hasMoreData,
      }
    } catch (err) {
      console.error('Error fetching messages:', err)
      return { messages: [], hasMore: false }
    }
  }, [roomId])

  // Fetch read counts for messages
  const fetchReadCounts = useCallback(async (messageIds) => {
    if (!messageIds.length) return

    try {
      const { data } = await supabase
        .from('message_reads')
        .select('message_id')
        .in('message_id', messageIds)

      if (data) {
        const counts = {}
        data.forEach(r => {
          counts[r.message_id] = (counts[r.message_id] || 0) + 1
        })
        setReadCounts(prev => ({ ...prev, ...counts }))
      }
    } catch (err) {
      console.error('Error fetching read counts:', err)
    }
  }, [])

  // Mark messages as read
  const markMessagesAsRead = useCallback(async (msgs) => {
    if (!currentUser || !msgs.length) return

    const unreadMessages = msgs.filter(
      m => m.sender_id !== currentUser.id && !m.is_deleted
    )

    if (!unreadMessages.length) return

    try {
      const reads = unreadMessages.map(m => ({
        message_id: m.id,
        user_id: currentUser.id,
        read_at: new Date().toISOString(),
      }))

      await supabase
        .from('message_reads')
        .upsert(reads, { onConflict: 'message_id,user_id', ignoreDuplicates: true })

      // Update read counts
      await fetchReadCounts(unreadMessages.map(m => m.id))

      // Mark notifications as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentUser.id)
        .eq('room_id', roomId)
        .eq('is_read', false)
    } catch (err) {
      console.error('Error marking as read:', err)
    }
  }, [currentUser, roomId, fetchReadCounts])

  // Initial load
  useEffect(() => {
    let mounted = true

    const init = async () => {
      setLoading(true)
      await fetchRoom()
      const { messages: msgs, hasMore: more } = await fetchMessages()

      if (mounted) {
        setMessages(msgs)
        setHasMore(more)
        setLoading(false)

        // Mark messages as read
        await markMessagesAsRead(msgs)
        await fetchReadCounts(msgs.map(m => m.id))
      }
    }

    init()

    return () => { mounted = false }
  }, [roomId, fetchRoom, fetchMessages, markMessagesAsRead, fetchReadCounts])

  // Auto-scroll to bottom
  useEffect(() => {
    if (!loading && isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading])

  // Track scroll position
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 100
  }, [])

  // Real-time subscription
  useEffect(() => {
    if (!roomId) return

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(`messages:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          // Fetch full message with profile
          const { data } = await supabase
            .from('messages')
            .select(`
              id, room_id, sender_id, content, file_url, file_name, file_type,
              is_deleted, created_at,
              profiles:sender_id (id, full_name, username, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            setMessages(prev => {
              const exists = prev.some(m => m.id === data.id)
              if (exists) return prev
              return [...prev, data]
            })

            // Mark as read if from another user
            if (data.sender_id !== currentUser?.id) {
              await markMessagesAsRead([data])
              isAtBottomRef.current = true
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          setMessages(prev =>
            prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m)
          )
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reads',
        },
        (payload) => {
          setReadCounts(prev => ({
            ...prev,
            [payload.new.message_id]: (prev[payload.new.message_id] || 0) + 1,
          }))
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [roomId, currentUser, markMessagesAsRead])

  // Load more messages
  const handleLoadMore = async () => {
    if (!messages.length || loadingMore) return

    const oldest = messages[0]
    setLoadingMore(true)

    const prevScrollHeight = messagesContainerRef.current?.scrollHeight

    const { messages: olderMsgs, hasMore: more } = await fetchMessages(oldest.created_at)
    setMessages(prev => [...olderMsgs, ...prev])
    setHasMore(more)
    setLoadingMore(false)

    await fetchReadCounts(olderMsgs.map(m => m.id))

    // Maintain scroll position
    requestAnimationFrame(() => {
      const container = messagesContainerRef.current
      if (container && prevScrollHeight) {
        container.scrollTop = container.scrollHeight - prevScrollHeight
      }
    })
  }

  // Handle message send
  const handleMessageSent = (newMessage) => {
    setMessages(prev => {
      const exists = prev.some(m => m.id === newMessage.id)
      if (exists) return prev
      return [...prev, newMessage]
    })
    isAtBottomRef.current = true
  }

  // Handle message delete
  const handleDeleteMessage = async (messageId) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_deleted: true, content: null })
        .eq('id', messageId)
        .eq('sender_id', currentUser.id)

      if (error) throw error

      setMessages(prev =>
        prev.map(m => m.id === messageId ? { ...m, is_deleted: true, content: null } : m)
      )
    } catch (err) {
      console.error('Error deleting message:', err)
    }
  }

  // Get room display name
  const getRoomName = () => {
    if (!room) return ''
    if (room.type === 'group') return room.name || '이름 없는 채널'
    const other = members.find(m => m.id !== currentUser?.id)
    return other?.full_name || '알 수 없음'
  }

  const getOtherMember = () => {
    if (room?.type !== 'direct') return null
    return members.find(m => m.id !== currentUser?.id)
  }

  // Group messages by date
  const groupedMessages = []
  messages.forEach((msg, idx) => {
    const prevMsg = messages[idx - 1]
    if (idx === 0 || !isSameDay(new Date(msg.created_at), new Date(prevMsg.created_at))) {
      groupedMessages.push({ type: 'date', date: msg.created_at, key: `date-${msg.created_at}` })
    }
    groupedMessages.push({ type: 'message', ...msg })
  })

  const otherMember = getOtherMember()

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <Loader className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Room Header */}
      <div className="h-14 flex items-center px-6 border-b border-chat-border shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {room?.type === 'group' ? (
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
              <Hash className="w-4 h-4 text-gray-500" />
            </div>
          ) : (
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white text-sm font-semibold">
                {getRoomName().charAt(0).toUpperCase()}
              </div>
              {otherMember && (
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                    isUserOnline(otherMember.id) || otherMember.is_online ? 'bg-green-400' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          )}

          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900 text-sm truncate">{getRoomName()}</h2>
            <p className="text-xs text-gray-500">
              {room?.type === 'group' ? (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {members.length}명
                </span>
              ) : otherMember ? (
                isUserOnline(otherMember.id) || otherMember.is_online ? '온라인' : '오프라인'
              ) : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-2 scrollbar-light"
      >
        {/* Load more button */}
        {hasMore && (
          <div className="flex justify-center py-3">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="flex items-center gap-2 text-sm text-brand-primary hover:text-brand-hover font-medium disabled:opacity-50"
            >
              {loadingMore ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
              {loadingMore ? '불러오는 중...' : '이전 메시지 더 보기'}
            </button>
          </div>
        )}

        {/* Message list */}
        {groupedMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                {room?.type === 'group' ? (
                  <Hash className="w-7 h-7 text-gray-400" />
                ) : (
                  <div className="text-2xl">💬</div>
                )}
              </div>
              <p className="text-gray-500 text-sm font-medium">
                {room?.type === 'group'
                  ? `#${getRoomName()} 채널의 시작입니다`
                  : `${getRoomName()}님과의 대화 시작입니다`}
              </p>
              <p className="text-gray-400 text-xs mt-1">첫 메시지를 보내보세요!</p>
            </div>
          </div>
        ) : (
          groupedMessages.map(item => {
            if (item.type === 'date') {
              return <DateSeparator key={item.key} date={item.date} />
            }

            const isSelf = item.sender_id === currentUser?.id
            const readCount = readCounts[item.id] || 0
            const memberCount = members.length

            return (
              <MessageBubble
                key={item.id}
                message={item}
                isSelf={isSelf}
                readCount={readCount}
                totalMembers={memberCount}
                onDelete={handleDeleteMessage}
              />
            )
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <MessageInput
        roomId={roomId}
        currentUser={currentUser}
        currentProfile={currentProfile}
        onMessageSent={handleMessageSent}
        roomName={getRoomName()}
      />
    </div>
  )
}
