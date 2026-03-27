import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MessageSquare,
  Plus,
  Hash,
  ChevronDown,
  ChevronRight,
  Settings,
  Circle,
  Users,
  UserPlus,
  X,
  Check,
  Loader,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

function OnlineIndicator({ isOnline, size = 'sm' }) {
  const sizeClass = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'
  return (
    <span
      className={`${sizeClass} rounded-full flex-shrink-0 ${
        isOnline ? 'bg-green-400 online-pulse' : 'bg-gray-500'
      }`}
    />
  )
}

function NewDMModal({ onClose, onDMCreated, currentUserId }) {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true)
      try {
        let query = supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, is_online')
          .neq('id', currentUserId)
          .eq('is_active', true)
          .order('full_name')

        if (search) {
          query = query.or(`full_name.ilike.%${search}%,username.ilike.%${search}%`)
        }

        const { data, error } = await query.limit(20)
        if (error) throw error
        setUsers(data || [])
      } catch (err) {
        console.error('Error fetching users:', err)
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(fetchUsers, 200)
    return () => clearTimeout(timer)
  }, [search, currentUserId])

  const handleStartDM = async (otherUser) => {
    setCreating(true)
    try {
      const { data, error } = await supabase.rpc('get_or_create_dm', {
        other_user_id: otherUser.id,
      })
      if (error) throw error
      onDMCreated(data, otherUser)
      onClose()
    } catch (err) {
      toast.error('대화 시작에 실패했습니다.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-[#1a1d21] border border-sidebar-border rounded-xl w-full max-w-md mx-4 shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <h3 className="text-white font-semibold">새 다이렉트 메시지</h3>
          <button onClick={onClose} className="text-sidebar-muted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 사용자명으로 검색..."
            className="w-full bg-sidebar-bg border border-sidebar-border rounded-lg py-2 px-3 text-white placeholder-sidebar-muted text-sm focus:border-brand-primary outline-none"
            autoFocus
          />
        </div>

        <div className="max-h-64 overflow-y-auto px-2 pb-2">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader className="w-5 h-5 animate-spin text-sidebar-muted" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-sidebar-muted text-sm py-6">
              {search ? '검색 결과가 없습니다.' : '사용자가 없습니다.'}
            </p>
          ) : (
            users.map((u) => (
              <button
                key={u.id}
                onClick={() => handleStartDM(u)}
                disabled={creating}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-sidebar-hover transition-colors text-left"
              >
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-full bg-brand-primary flex items-center justify-center text-white text-sm font-semibold">
                    {u.full_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <OnlineIndicator
                    isOnline={u.is_online}
                    size="sm"
                  />
                </div>
                <div>
                  <p className="text-sidebar-text text-sm font-medium">{u.full_name}</p>
                  <p className="text-sidebar-muted text-xs">@{u.username}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default function Sidebar({ activeRoomId, onSelectRoom, onOpenAdmin, isUserOnline, rooms, setRooms }) {
  const { user, profile, isAdmin, toggleOnlineStatus } = useAuth()
  const navigate = useNavigate()

  const [dmRooms, setDmRooms] = useState([])
  const [groupRooms, setGroupRooms] = useState([])
  const [showDMs, setShowDMs] = useState(true)
  const [showGroups, setShowGroups] = useState(true)
  const [showNewDM, setShowNewDM] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState({})
  const [dmPartners, setDmPartners] = useState({})

  const fetchRooms = useCallback(async () => {
    if (!user) return

    try {
      // Fetch all rooms user is member of
      const { data: memberData, error } = await supabase
        .from('room_members')
        .select(`
          room_id,
          rooms (
            id, type, name, description, created_by, created_at
          )
        `)
        .eq('user_id', user.id)

      if (error) throw error

      const allRooms = memberData?.map(m => m.rooms).filter(Boolean) || []
      const dms = allRooms.filter(r => r.type === 'direct')
      const groups = allRooms.filter(r => r.type === 'group')

      setGroupRooms(groups)
      setRooms(allRooms)

      // For DMs, fetch the other user's info
      const dmPartnersMap = {}
      for (const room of dms) {
        const { data: members } = await supabase
          .from('room_members')
          .select('user_id, profiles(id, full_name, username, is_online, avatar_url)')
          .eq('room_id', room.id)
          .neq('user_id', user.id)
          .single()

        if (members?.profiles) {
          dmPartnersMap[room.id] = members.profiles
        }
      }
      setDmPartners(dmPartnersMap)
      setDmRooms(dms)

      // Fetch unread counts
      await fetchUnreadCounts(allRooms.map(r => r.id))
    } catch (err) {
      console.error('Error fetching rooms:', err)
    }
  }, [user, setRooms])

  const fetchUnreadCounts = async (roomIds) => {
    if (!user || roomIds.length === 0) return

    try {
      const counts = {}
      for (const roomId of roomIds) {
        // Count messages in this room that user hasn't read
        const { data: messages } = await supabase
          .from('messages')
          .select('id')
          .eq('room_id', roomId)
          .eq('is_deleted', false)
          .neq('sender_id', user.id)

        if (!messages?.length) {
          counts[roomId] = 0
          continue
        }

        const messageIds = messages.map(m => m.id)
        const { data: reads } = await supabase
          .from('message_reads')
          .select('message_id')
          .eq('user_id', user.id)
          .in('message_id', messageIds)

        const readIds = new Set((reads || []).map(r => r.message_id))
        counts[roomId] = messageIds.filter(id => !readIds.has(id)).length
      }
      setUnreadCounts(counts)
    } catch (err) {
      console.error('Error fetching unread counts:', err)
    }
  }

  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  // Real-time subscription for room_members changes
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`room-members:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_members',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchRooms()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const roomId = payload.new.room_id
          if (roomId !== activeRoomId && payload.new.sender_id !== user.id) {
            setUnreadCounts(prev => ({
              ...prev,
              [roomId]: (prev[roomId] || 0) + 1,
            }))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, activeRoomId, fetchRooms])

  // Clear unread count when entering a room
  useEffect(() => {
    if (activeRoomId) {
      setUnreadCounts(prev => ({ ...prev, [activeRoomId]: 0 }))
    }
  }, [activeRoomId])

  const handleDMCreated = (roomId, partner) => {
    const newRoom = { id: roomId, type: 'direct' }
    setDmPartners(prev => ({ ...prev, [roomId]: partner }))
    onSelectRoom(newRoom)
    fetchRooms()
  }

  const getRoomDisplayName = (room) => {
    if (room.type === 'group') return room.name
    const partner = dmPartners[room.id]
    return partner?.full_name || '알 수 없음'
  }

  return (
    <>
      <aside className="w-[280px] bg-sidebar-bg flex flex-col border-r border-sidebar-border shrink-0">
        {/* Company Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand-primary rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">사내 메신저</span>
          </div>
        </div>

        {/* New Message Button */}
        <div className="px-3 py-3">
          <button
            onClick={() => setShowNewDM(true)}
            className="w-full flex items-center gap-2 bg-brand-primary hover:bg-brand-hover text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            새 대화
          </button>
        </div>

        {/* Nav Content */}
        <div className="flex-1 overflow-y-auto py-1">
          {/* Direct Messages Section */}
          <div className="mb-2">
            <button
              onClick={() => setShowDMs(!showDMs)}
              className="w-full flex items-center justify-between px-4 py-1.5 text-sidebar-muted hover:text-sidebar-text transition-colors group"
            >
              <span className="text-xs font-semibold uppercase tracking-wide">다이렉트 메시지</span>
              {showDMs ? (
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              )}
            </button>

            {showDMs && (
              <div className="mt-0.5">
                {dmRooms.length === 0 ? (
                  <p className="px-4 py-2 text-xs text-sidebar-muted">
                    아직 대화가 없습니다.
                  </p>
                ) : (
                  dmRooms.map(room => {
                    const partner = dmPartners[room.id]
                    const isActive = activeRoomId === room.id
                    const unread = unreadCounts[room.id] || 0
                    const online = partner ? isUserOnline(partner.id) || partner.is_online : false

                    return (
                      <button
                        key={room.id}
                        onClick={() => onSelectRoom(room)}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 mx-1 rounded-lg transition-colors text-left ${
                          isActive
                            ? 'bg-sidebar-active text-white'
                            : 'text-sidebar-text hover:bg-sidebar-hover'
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                            {getRoomDisplayName(room).charAt(0).toUpperCase()}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${
                              isActive ? 'border-sidebar-active' : 'border-sidebar-bg'
                            } ${online ? 'bg-green-400' : 'bg-gray-500'}`}
                          />
                        </div>
                        <span className={`flex-1 text-sm truncate ${unread > 0 ? 'font-semibold' : 'font-normal'}`}>
                          {getRoomDisplayName(room)}
                        </span>
                        {unread > 0 && (
                          <span className="unread-badge bg-red-500 text-white text-xs min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 flex-shrink-0">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                      </button>
                    )
                  })
                )}

                <button
                  onClick={() => setShowNewDM(true)}
                  className="w-full flex items-center gap-2 px-4 py-1.5 text-sidebar-muted hover:text-sidebar-text transition-colors text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  다이렉트 메시지 추가
                </button>
              </div>
            )}
          </div>

          {/* Groups Section */}
          <div className="mb-2">
            <button
              onClick={() => setShowGroups(!showGroups)}
              className="w-full flex items-center justify-between px-4 py-1.5 text-sidebar-muted hover:text-sidebar-text transition-colors"
            >
              <span className="text-xs font-semibold uppercase tracking-wide">채널 / 그룹</span>
              {showGroups ? (
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              )}
            </button>

            {showGroups && (
              <div className="mt-0.5">
                {groupRooms.length === 0 ? (
                  <p className="px-4 py-2 text-xs text-sidebar-muted">
                    참여 중인 채널이 없습니다.
                  </p>
                ) : (
                  groupRooms.map(room => {
                    const isActive = activeRoomId === room.id
                    const unread = unreadCounts[room.id] || 0

                    return (
                      <button
                        key={room.id}
                        onClick={() => onSelectRoom(room)}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 mx-1 rounded-lg transition-colors text-left ${
                          isActive
                            ? 'bg-sidebar-active text-white'
                            : 'text-sidebar-text hover:bg-sidebar-hover'
                        }`}
                      >
                        <Hash className="w-4 h-4 flex-shrink-0 opacity-70" />
                        <span className={`flex-1 text-sm truncate ${unread > 0 ? 'font-semibold' : 'font-normal'}`}>
                          {room.name || '이름 없는 채널'}
                        </span>
                        {unread > 0 && (
                          <span className="unread-badge bg-red-500 text-white text-xs min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 flex-shrink-0">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom User Profile */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-lg bg-brand-primary flex items-center justify-center text-white text-sm font-semibold">
                {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <button
                onClick={toggleOnlineStatus}
                title={profile?.is_online ? '자리 비움으로 변경' : '온라인으로 변경'}
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-sidebar-bg cursor-pointer hover:scale-110 transition-transform ${
                  profile?.is_online ? 'bg-green-400' : 'bg-gray-500'
                }`}
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{profile?.full_name}</p>
              <p className="text-sidebar-muted text-xs truncate">
                {profile?.is_online ? '온라인' : '오프라인'}
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={onOpenAdmin}
                title="관리자 패널"
                className="p-1.5 text-sidebar-muted hover:text-white hover:bg-sidebar-hover rounded-lg transition-colors flex-shrink-0"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {showNewDM && (
        <NewDMModal
          onClose={() => setShowNewDM(false)}
          onDMCreated={handleDMCreated}
          currentUserId={user?.id}
        />
      )}
    </>
  )
}
