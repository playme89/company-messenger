import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function usePresence(userId) {
  const [onlineUsers, setOnlineUsers] = useState(new Set())
  const channelRef = useRef(null)

  const trackPresence = useCallback(async () => {
    if (!userId) return

    // Clean up existing channel
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current)
    }

    const channel = supabase.channel('presence:online-users', {
      config: {
        presence: {
          key: userId,
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const online = new Set(Object.keys(state))
        setOnlineUsers(online)
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUsers(prev => new Set([...prev, key]))
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers(prev => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          })
        }
      })

    channelRef.current = channel
  }, [userId])

  const untrackPresence = useCallback(async () => {
    if (channelRef.current) {
      await channelRef.current.untrack()
      await supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [])

  useEffect(() => {
    if (userId) {
      trackPresence()
    }

    return () => {
      untrackPresence()
    }
  }, [userId, trackPresence, untrackPresence])

  const isUserOnline = useCallback(
    (checkUserId) => {
      return onlineUsers.has(checkUserId)
    },
    [onlineUsers]
  )

  return {
    onlineUsers,
    isUserOnline,
    trackPresence,
    untrackPresence,
  }
}
