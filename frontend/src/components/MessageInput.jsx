import React, { useState, useRef, useCallback } from 'react'
import { Paperclip, Send, X, Image, File, Loader } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

function FilePreview({ file, preview, onRemove }) {
  const isImage = file.type.startsWith('image/')

  return (
    <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-2 max-w-xs">
      {isImage && preview ? (
        <img
          src={preview}
          alt={file.name}
          className="w-12 h-12 object-cover rounded"
        />
      ) : (
        <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
          <File className="w-5 h-5 text-gray-500" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 truncate">{file.name}</p>
        <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
      </div>
      <button
        onClick={onRemove}
        className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
      >
        <X className="w-3.5 h-3.5 text-gray-500" />
      </button>
    </div>
  )
}

export default function MessageInput({ roomId, currentUser, currentProfile, onMessageSent, roomName }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [sending, setSending] = useState(false)

  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    if (selected.size > MAX_FILE_SIZE) {
      toast.error('파일 크기는 10MB 이하여야 합니다.')
      return
    }

    setFile(selected)

    if (selected.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (ev) => setFilePreview(ev.target?.result)
      reader.readAsDataURL(selected)
    } else {
      setFilePreview(null)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveFile = () => {
    setFile(null)
    setFilePreview(null)
    setUploadProgress(0)
  }

  const uploadFile = async (fileToUpload) => {
    const ext = fileToUpload.name.split('.').pop()
    const fileName = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`

    setUploading(true)
    setUploadProgress(10)

    try {
      const { data, error } = await supabase.storage
        .from('chat-files')
        .upload(fileName, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) throw error

      setUploadProgress(80)

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('chat-files')
        .getPublicUrl(fileName)

      setUploadProgress(100)
      return {
        url: urlData.publicUrl,
        name: fileToUpload.name,
        type: fileToUpload.type,
      }
    } finally {
      setUploading(false)
    }
  }

  const handleSend = useCallback(async () => {
    if ((!text.trim() && !file) || sending) return

    setSending(true)
    try {
      let fileData = null

      if (file) {
        fileData = await uploadFile(file)
      }

      const messagePayload = {
        room_id: roomId,
        sender_id: currentUser.id,
        content: text.trim() || null,
        file_url: fileData?.url || null,
        file_name: fileData?.name || null,
        file_type: fileData?.type || null,
      }

      const { data, error } = await supabase
        .from('messages')
        .insert(messagePayload)
        .select(`
          id, room_id, sender_id, content, file_url, file_name, file_type,
          is_deleted, created_at,
          profiles:sender_id (id, full_name, username, avatar_url)
        `)
        .single()

      if (error) throw error

      onMessageSent(data)
      setText('')
      handleRemoveFile()

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (err) {
      console.error('Error sending message:', err)
      toast.error('메시지 전송에 실패했습니다.')
    } finally {
      setSending(false)
      setUploadProgress(0)
    }
  }, [text, file, sending, roomId, currentUser, onMessageSent])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextChange = (e) => {
    setText(e.target.value)
    // Auto-resize textarea
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }

  const canSend = (text.trim() || file) && !sending && !uploading

  return (
    <div className="border-t border-chat-border bg-white px-4 py-3 shrink-0">
      {/* File Preview */}
      {file && (
        <div className="mb-2">
          <FilePreview
            file={file}
            preview={filePreview}
            onRemove={handleRemoveFile}
          />
          {uploading && uploadProgress > 0 && (
            <div className="mt-1.5 w-full bg-gray-200 rounded-full h-1">
              <div
                className="bg-brand-primary h-1 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary transition-colors">
        {/* File attach button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending || uploading}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors mb-0.5"
          title="파일 첨부"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
        />

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={`${roomName || ''}에 메시지 보내기... (Shift+Enter: 줄바꿈)`}
          className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 text-sm resize-none outline-none min-h-[24px] max-h-[160px] py-0.5 leading-relaxed"
          rows={1}
          disabled={sending || uploading}
        />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={`flex-shrink-0 p-1.5 rounded-lg transition-all mb-0.5 ${
            canSend
              ? 'bg-brand-primary text-white hover:bg-brand-hover'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
          title="전송 (Enter)"
        >
          {sending || uploading ? (
            <Loader className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-1 text-right">
        Enter: 전송 · Shift+Enter: 줄바꿈
      </p>
    </div>
  )
}
