import React, { useState, useRef, useCallback, useEffect } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { File, Download, Trash2, X, CheckCheck } from 'lucide-react'

function ImageViewer({ url, name, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="image-overlay animate-fade-in"
      onClick={onClose}
    >
      <div className="relative max-w-5xl max-h-full p-4" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4 text-gray-700" />
        </button>
        <img
          src={url}
          alt={name || '이미지'}
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />
        {name && (
          <p className="text-white text-sm text-center mt-2 opacity-70">{name}</p>
        )}
      </div>
    </div>
  )
}

function ContextMenu({ x, y, onDelete, onClose }) {
  useEffect(() => {
    const handler = () => onClose()
    window.addEventListener('click', handler)
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') onClose() })
    return () => window.removeEventListener('click', handler)
  }, [onClose])

  return (
    <div
      className="context-menu animate-scale-in"
      style={{ top: y, left: x }}
      onClick={e => e.stopPropagation()}
    >
      <button
        onClick={() => { onDelete(); onClose() }}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        메시지 삭제
      </button>
    </div>
  )
}

export default function MessageBubble({ message, isSelf, readCount, totalMembers, onDelete }) {
  const [showImageViewer, setShowImageViewer] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const longPressTimer = useRef(null)

  const isImage = message.file_type?.startsWith('image/')
  const isFile = !!message.file_url && !isImage
  const isDeleted = message.is_deleted

  const timeStr = format(new Date(message.created_at), 'HH:mm', { locale: ko })

  // Context menu on right-click (own messages only)
  const handleContextMenu = useCallback((e) => {
    if (!isSelf || isDeleted) return
    e.preventDefault()
    const menuX = Math.min(e.clientX, window.innerWidth - 180)
    const menuY = Math.min(e.clientY, window.innerHeight - 100)
    setContextMenu({ x: menuX, y: menuY })
  }, [isSelf, isDeleted])

  // Long press for mobile
  const handleTouchStart = useCallback((e) => {
    if (!isSelf || isDeleted) return
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches[0]
      setContextMenu({
        x: Math.min(touch.clientX, window.innerWidth - 180),
        y: Math.min(touch.clientY, window.innerHeight - 100),
      })
    }, 600)
  }, [isSelf, isDeleted])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
    }
  }, [])

  // Read receipt label
  const getReadLabel = () => {
    if (!isSelf) return null
    // readCount includes the sender themselves if they read it, so we show other readers
    const otherReaders = Math.max(0, readCount - 1) // subtract sender's own read
    if (otherReaders <= 0) return null
    const others = totalMembers - 1 // exclude sender
    if (others <= 0) return null
    return `읽음 ${otherReaders}명`
  }

  const readLabel = getReadLabel()

  return (
    <>
      <div
        className={`flex items-end gap-2 mb-1 group ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Avatar (only for received messages) */}
        {!isSelf && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mb-1">
            {message.profiles?.full_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
        )}

        <div className={`flex flex-col max-w-[65%] ${isSelf ? 'items-end' : 'items-start'}`}>
          {/* Sender name (only for received) */}
          {!isSelf && (
            <span className="text-xs text-gray-500 font-medium mb-1 ml-1">
              {message.profiles?.full_name || '알 수 없음'}
            </span>
          )}

          {/* Message bubble */}
          <div
            className={`relative rounded-2xl px-3.5 py-2.5 shadow-sm ${
              isDeleted
                ? 'bg-gray-100 border border-gray-200'
                : isSelf
                ? 'bg-brand-primary text-white rounded-br-sm'
                : 'bg-gray-100 text-gray-900 rounded-bl-sm'
            }`}
          >
            {isDeleted ? (
              <p className="text-xs text-gray-400 italic">삭제된 메시지입니다</p>
            ) : (
              <>
                {/* Text content */}
                {message.content && (
                  <p className="message-content text-sm leading-relaxed">{message.content}</p>
                )}

                {/* Image */}
                {isImage && message.file_url && (
                  <button
                    onClick={() => setShowImageViewer(true)}
                    className={`block rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ${
                      message.content ? 'mt-2' : ''
                    }`}
                  >
                    <img
                      src={message.file_url}
                      alt={message.file_name || '이미지'}
                      className="max-w-full max-h-64 object-cover rounded-lg"
                      loading="lazy"
                    />
                  </button>
                )}

                {/* File attachment */}
                {isFile && message.file_url && (
                  <a
                    href={message.file_url}
                    download={message.file_name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2.5 ${
                      message.content ? 'mt-2' : ''
                    } p-2.5 rounded-lg border ${
                      isSelf
                        ? 'border-blue-400/30 bg-white/10 hover:bg-white/20'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    } transition-colors`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isSelf ? 'bg-white/20' : 'bg-brand-light'
                    }`}>
                      <File className={`w-4 h-4 ${isSelf ? 'text-white' : 'text-brand-primary'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${isSelf ? 'text-white' : 'text-gray-800'}`}>
                        {message.file_name || '파일'}
                      </p>
                      <p className={`text-xs ${isSelf ? 'text-blue-200' : 'text-gray-400'}`}>
                        파일 다운로드
                      </p>
                    </div>
                    <Download className={`w-4 h-4 flex-shrink-0 ${isSelf ? 'text-blue-200' : 'text-gray-400'}`} />
                  </a>
                )}
              </>
            )}
          </div>

          {/* Time + read receipt */}
          <div className={`flex items-center gap-1.5 mt-0.5 ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="text-[11px] text-gray-400">{timeStr}</span>
            {readLabel && (
              <span className="flex items-center gap-0.5 text-[11px] text-brand-primary font-medium">
                <CheckCheck className="w-3 h-3" />
                {readLabel}
              </span>
            )}
          </div>
        </div>

        {/* Spacer for self messages (where avatar would be) */}
        {isSelf && <div className="w-8 flex-shrink-0" />}
      </div>

      {/* Image Viewer */}
      {showImageViewer && message.file_url && (
        <ImageViewer
          url={message.file_url}
          name={message.file_name}
          onClose={() => setShowImageViewer(false)}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDelete={() => onDelete(message.id)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}
