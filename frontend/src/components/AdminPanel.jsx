import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  X, Users, MessageSquare, Activity, Crown, UserX, UserCheck,
  Hash, Plus, Loader, RefreshCw, ChevronDown
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? <span className="skeleton w-8 h-6 inline-block" />}</p>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
      </div>
    </div>
  )
}

export default function AdminPanel({ onClose }) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  // Create group form
  const [groupName, setGroupName] = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const [selectedMembers, setSelectedMembers] = useState([])
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [allUsers, setAllUsers] = useState([])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
      setAllUsers(data || [])
    } catch (err) {
      toast.error('사용자 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const [
        { count: totalUsers },
        { count: onlineUsers },
        { count: totalMessages },
        { count: totalRooms },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_online', true),
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
        supabase.from('rooms').select('*', { count: 'exact', head: true }),
      ])

      setStats({ totalUsers, onlineUsers, totalMessages, totalRooms })
    } catch (err) {
      console.error('Stats error:', err)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchStats()
  }, [fetchUsers, fetchStats])

  const handleRoleChange = async (targetUser) => {
    if (targetUser.id === user?.id) {
      toast.error('자신의 권한은 변경할 수 없습니다.')
      return
    }

    const newRole = targetUser.role === 'admin' ? 'member' : 'admin'
    setActionLoading(targetUser.id + '-role')

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', targetUser.id)

      if (error) throw error

      setUsers(prev =>
        prev.map(u => u.id === targetUser.id ? { ...u, role: newRole } : u)
      )
      toast.success(`${targetUser.full_name}님의 권한이 ${newRole === 'admin' ? '관리자' : '일반 사용자'}로 변경되었습니다.`)
    } catch (err) {
      toast.error('권한 변경에 실패했습니다.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleActive = async (targetUser) => {
    if (targetUser.id === user?.id) {
      toast.error('자신의 계정은 비활성화할 수 없습니다.')
      return
    }

    const newStatus = !targetUser.is_active
    setActionLoading(targetUser.id + '-active')

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newStatus })
        .eq('id', targetUser.id)

      if (error) throw error

      setUsers(prev =>
        prev.map(u => u.id === targetUser.id ? { ...u, is_active: newStatus } : u)
      )
      toast.success(`${targetUser.full_name}님의 계정이 ${newStatus ? '활성화' : '비활성화'}되었습니다.`)
    } catch (err) {
      toast.error('계정 상태 변경에 실패했습니다.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCreateGroup = async (e) => {
    e.preventDefault()

    if (!groupName.trim()) {
      toast.error('채널 이름을 입력해주세요.')
      return
    }

    setCreatingGroup(true)
    try {
      // Create room
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({
          type: 'group',
          name: groupName.trim(),
          description: groupDesc.trim() || null,
          created_by: user?.id,
        })
        .select()
        .single()

      if (roomError) throw roomError

      // Add creator + selected members
      const memberIds = [...new Set([user?.id, ...selectedMembers])]
      const { error: memberError } = await supabase
        .from('room_members')
        .insert(memberIds.map(uid => ({ room_id: room.id, user_id: uid })))

      if (memberError) throw memberError

      toast.success(`#${groupName} 채널이 생성되었습니다!`)
      setGroupName('')
      setGroupDesc('')
      setSelectedMembers([])
    } catch (err) {
      toast.error('채널 생성에 실패했습니다.')
      console.error(err)
    } finally {
      setCreatingGroup(false)
    }
  }

  const tabs = [
    { id: 'users', label: '사용자 관리', icon: Users },
    { id: 'groups', label: '채널 생성', icon: Hash },
    { id: 'stats', label: '통계', icon: Activity },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-primary rounded-xl flex items-center justify-center">
              <Crown className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">관리자 패널</h2>
              <p className="text-xs text-gray-500">사용자 및 채널을 관리하세요</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchUsers(); fetchStats() }}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="새로고침"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-light">
          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="p-4">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">사용자</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">이메일</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">권한</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">상태</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">가입일</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="relative flex-shrink-0">
                                <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white text-xs font-semibold">
                                  {u.full_name?.charAt(0)?.toUpperCase()}
                                </div>
                                <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${
                                  u.is_online ? 'bg-green-400' : 'bg-gray-300'
                                }`} />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                                <p className="text-xs text-gray-500">@{u.username}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-sm text-gray-600">{u.id}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                              u.role === 'admin'
                                ? 'bg-brand-light text-brand-primary'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {u.role === 'admin' && <Crown className="w-3 h-3" />}
                              {u.role === 'admin' ? '관리자' : '일반 사용자'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`text-xs font-medium ${
                              u.is_active ? 'text-green-600' : 'text-red-500'
                            }`}>
                              {u.is_active ? '활성' : '비활성'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-xs text-gray-500">
                              {format(new Date(u.created_at), 'yyyy.MM.dd', { locale: ko })}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-end gap-1">
                              {/* Role change */}
                              <button
                                onClick={() => handleRoleChange(u)}
                                disabled={actionLoading === u.id + '-role' || u.id === user?.id}
                                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-40 transition-colors"
                                title={u.role === 'admin' ? '일반 사용자로 변경' : '관리자로 변경'}
                              >
                                {actionLoading === u.id + '-role' ? (
                                  <Loader className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Crown className="w-3 h-3" />
                                )}
                                {u.role === 'admin' ? '강등' : '승격'}
                              </button>

                              {/* Activate/deactivate */}
                              <button
                                onClick={() => handleToggleActive(u)}
                                disabled={actionLoading === u.id + '-active' || u.id === user?.id}
                                className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
                                  u.is_active
                                    ? 'border-red-200 text-red-600 hover:bg-red-50'
                                    : 'border-green-200 text-green-600 hover:bg-green-50'
                                }`}
                                title={u.is_active ? '비활성화' : '활성화'}
                              >
                                {actionLoading === u.id + '-active' ? (
                                  <Loader className="w-3 h-3 animate-spin" />
                                ) : u.is_active ? (
                                  <UserX className="w-3 h-3" />
                                ) : (
                                  <UserCheck className="w-3 h-3" />
                                )}
                                {u.is_active ? '비활성화' : '활성화'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Groups Tab */}
          {activeTab === 'groups' && (
            <div className="p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">새 그룹 채널 생성</h3>
              <form onSubmit={handleCreateGroup} className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    채널 이름 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="예: general, 개발팀, 마케팅"
                      className="w-full border border-gray-200 rounded-lg py-2.5 pl-9 pr-4 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    설명 (선택)
                  </label>
                  <textarea
                    value={groupDesc}
                    onChange={(e) => setGroupDesc(e.target.value)}
                    placeholder="채널에 대한 설명을 입력하세요"
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    멤버 추가 (선택)
                  </label>
                  <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto scrollbar-light">
                    {allUsers.filter(u => u.id !== user?.id).map(u => (
                      <label
                        key={u.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMembers(prev => [...prev, u.id])
                            } else {
                              setSelectedMembers(prev => prev.filter(id => id !== u.id))
                            }
                          }}
                          className="w-4 h-4 text-brand-primary rounded border-gray-300 accent-brand-primary"
                        />
                        <div className="w-7 h-7 rounded-full bg-brand-primary flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                          {u.full_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm text-gray-800 font-medium">{u.full_name}</p>
                          <p className="text-xs text-gray-500">@{u.username}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {selectedMembers.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{selectedMembers.length}명 선택됨 (본인 포함 자동 추가)</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={creatingGroup || !groupName.trim()}
                  className="flex items-center gap-2 bg-brand-primary hover:bg-brand-hover text-white font-semibold py-2.5 px-6 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {creatingGroup ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      채널 생성
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Stats Tab */}
          {activeTab === 'stats' && (
            <div className="p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">시스템 통계</h3>
              <div className="grid grid-cols-2 gap-4">
                <StatCard
                  icon={Users}
                  label="전체 사용자"
                  value={stats.totalUsers}
                  color="bg-blue-500"
                />
                <StatCard
                  icon={Activity}
                  label="현재 온라인"
                  value={stats.onlineUsers}
                  color="bg-green-500"
                />
                <StatCard
                  icon={MessageSquare}
                  label="전체 메시지"
                  value={stats.totalMessages}
                  color="bg-purple-500"
                />
                <StatCard
                  icon={Hash}
                  label="전체 채널"
                  value={stats.totalRooms}
                  color="bg-orange-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
