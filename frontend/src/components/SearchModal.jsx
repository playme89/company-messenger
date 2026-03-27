import React, { useState, useEffect, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Search, X, MessageSquare, User, Hash, Loader, AtSign } from 'lucide-react'
import { supabase } from '../lib/supabase'

function HighlightText({ text, query }) {
  if (!query || !text) return <span>{text}</span>

  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))

  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-100 text-yellow-800 font-medium rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
}

export default function SearchModal({ onClose, onSelectRoom, currentUser }) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [messageResults, setMessageResults] = useState([])
  const [userResults, setUserResults] = useState([])
  const [roomNames, setRoomNames] = useState({})

  const inputRef = useRef(null)
  const searchTimerRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()

    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const fetchRoomName = async (roomId) => {
    const { data } = await supabase
      .from('rooms')
      .select('type, name')
      .eq('id', roomId)
      .single()
    return data
  }

  const search = useCallback(async (q) => {
    if (!q.trim() || q.length < 1) {
      setMessageResults([])
      setUserResults([])
      return
    }

    setSearching(true)
    try {
      // Search messages in rooms user is member of
      const { data: userRooms } = await supabase
        .from('room_members')
        .select('room_id')
        .eq('user_id', currentUser.id)

      const roomIds = userRooms?.map(r => r.room_id) || []

      const [messagesRes, usersRes] = await Promise.all([
        // Search messages
        roomIds.length > 0
          ? supabase
              .from('messages')
              .select(`
                id, room_id, content, created_at, is_deleted,
                profiles:sender_id (id, full_name, username, avatar_url)
              `)
              .in('room_id', roomIds)
              .eq('is_deleted', false)
              .ilike('content', `%${q}%`)
              .order('created_at', { ascending: false })
              .limit(20)
          : { data: [] },

        // Search users
        supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, is_online, role')
          .or(`full_name.ilike.%${q}%,username.ilike.%${q}%`)
          .eq('is_active', true)
          .limit(10),
      ])

      const messages = messagesRes.data || []
      setMessageResults(messages)
      setUserResults(usersRes.data || [])

      // Fetch room names for messages
      const uniqueRoomIds = [...new Set(messages.map(m => m.room_id))]
      const names = {}
      await Promise.all(
        uniqueRoomIds.map(async (rid) => {
          const roomData = await fetchRoomName(rid)
          if (roomData) {
            names[rid] = roomData
          }
        })
      )
      setRoomNames(names)
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setSearching(false)
    }
  }, [currentUser])

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)

    if (query.length >= 1) {
      searchTimerRef.current = setTimeout(() => search(query), 300)
    } else {
      setMessageResults([])
      setUserResults([])
    }

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [query, search])

  const handleMessageClick = async (msg) => {
    // Start DM or navigate to room
    const room = { id: msg.room_id, type: roomNames[msg.room_id]?.type }
    onSelectRoom(room)
    onClose()
  }

  const handleUserClick = async (targetUser) => {
    try {
      const { data: roomId, error } = await supabase.rpc('get_or_create_dm', {
        other_user_id: targetUser.id,
      })
      if (error) throw error
      onSelectRoom({ id: roomId, type: 'direct' })
      onClose()
    } catch (err) {
      console.error('Error opening DM:', err)
    }
  }

  const getRoomDisplayName = (roomId) => {
    const room = roomNames[roomId]
    if (!room) return '알 수 없는 채널'
    if (room.type === 'group') return `#${room.name || '이름 없음'}`
    return '다이렉트 메시지'
  }

  const hasResults = messageResults.length > 0 || userResults.length > 0
  const showEmpty = query.length >= 1 && !searching && !hasResults

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 pt-20 px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          {searching ? (
            <Loader className="w-5 h-5 text-gray-400 animate-spin flex-shrink-0" />
          ) : (
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="메시지 또는 사용자 검색..."
            className="flex-1 text-gray-900 placeholder-gray-400 text-base outline-none bg-transparent"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-2 py-1 font-mono transition-colors"
          >
            ESC
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto scrollbar-light">
          {!query && (
            <div className="py-12 text-center">
              <Search className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">검색어를 입력하세요</p>
              <p className="text-gray-300 text-xs mt-1">메시지 내용 또는 사용자 이름으로 검색할 수 있습니다</p>
            </div>
          )}

          {showEmpty && (
            <div className="py-12 text-center">
              <p className="text-gray-500 text-sm font-medium">검색 결과가 없습니다</p>
              <p className="text-gray-400 text-xs mt-1">"{query}"에 대한 결과를 찾을 수 없습니다</p>
            </div>
          )}

          {/* Users Section */}
          {userResults.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  사용자
                </p>
              </div>
              {userResults.map(u => (
                <button
                  key={u.id}
                  onClick={() => handleUserClick(u)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full bg-brand-primary flex items-center justify-center text-white text-sm font-semibold">
                      {u.full_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                      u.is_online ? 'bg-green-400' : 'bg-gray-300'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        <HighlightText text={u.full_name} query={query} />
                      </span>
                      {u.role === 'admin' && (
                        <span className="text-xs bg-brand-light text-brand-primary px-1.5 py-0.5 rounded-full font-medium">관리자</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      @<HighlightText text={u.username} query={query} />
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">메시지 보내기 →</span>
                </button>
              ))}
            </div>
          )}

          {/* Messages Section */}
          {messageResults.length > 0 && (
            <div className="py-2 border-t border-gray-50">
              <div className="px-4 py-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  메시지
                </p>
              </div>
              {messageResults.map(msg => (
                <button
                  key={msg.id}
                  onClick={() => handleMessageClick(msg)}
                  className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-0.5">
                    {msg.profiles?.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-gray-900">
                        {msg.profiles?.full_name || '알 수 없음'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {getRoomDisplayName(msg.room_id)}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {format(new Date(msg.created_at), 'M월 d일 HH:mm', { locale: ko })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      <HighlightText text={msg.content} query={query} />
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {hasResults && (
          <div className="px-4 py-2 border-t border-gray-50 bg-gray-50">
            <p className="text-xs text-gray-400">
              사용자 {userResults.length}명 · 메시지 {messageResults.length}개
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
