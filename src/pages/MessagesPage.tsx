/**
 * MessagesPage — 1:1 Direct Messages
 *
 * Routes:
 *   /messages          → Conversation list (+ empty state on desktop right pane)
 *   /messages/:userId  → Conversation list + open conversation with that user
 *
 * Layout:
 *   - Mobile:  list and conversation are full-screen, navigating to /:userId
 *              replaces the list view.
 *   - Desktop: split pane — list on the left, conversation on the right.
 */

import { useEffect, useRef, useState, useCallback, FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, MessageSquare, Send, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Avatar } from '../components/ProfileCard'
import { generateAvatar } from '../lib/avatarGenerator'
import {
  getConversations,
  getMessages,
  sendMessage,
  markConversationRead,
  subscribeToDirectMessages,
  type Conversation,
  type DmMessage,
} from '../lib/dmService'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/supabase'
import { formatDistanceToNow } from '../lib/formatDate'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  try {
    return formatDistanceToNow(new Date(dateStr))
  } catch {
    return ''
  }
}

// ─── Conversation List ────────────────────────────────────────────────────────

interface ConversationListProps {
  conversations: Conversation[]
  loading: boolean
  selectedUserId?: string
  onSelect: (userId: string) => void
}

function ConversationList({ conversations, loading, selectedUserId, onSelect }: ConversationListProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <MessageSquare size={32} className="text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No messages yet</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Visit a friend's profile to start a conversation.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
      {conversations.map((conv) => {
        const isSelected = conv.partnerId === selectedUserId
        return (
          <li key={conv.partnerId}>
            <button
              onClick={() => onSelect(conv.partnerId)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                isSelected
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <div className="relative shrink-0">
                <Avatar profile={conv.partner} size="md" />
                {conv.unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-600 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className={`text-sm truncate ${
                      conv.unreadCount > 0
                        ? 'font-semibold text-gray-900 dark:text-gray-100'
                        : 'font-medium text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {conv.partner.display_name}
                  </p>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0">
                    {timeAgo(conv.lastMessage.created_at)}
                  </span>
                </div>
                <p
                  className={`text-xs truncate mt-0.5 ${
                    conv.unreadCount > 0
                      ? 'font-medium text-gray-700 dark:text-gray-300'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {conv.lastMessage.body}
                </p>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ─── Conversation Thread ───────────────────────────────────────────────────────

interface ConversationThreadProps {
  currentUserId: string
  partnerId: string
  onBack: () => void
  onMessageSent: () => void
}

function ConversationThread({ currentUserId, partnerId, onBack, onMessageSent }: ConversationThreadProps) {
  const toast = useToast()
  const [partner, setPartner] = useState<Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null>(null)
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load partner profile + messages.
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const [{ data: profileData }, msgs] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .eq('id', partnerId)
          .single(),
        getMessages(currentUserId, partnerId),
      ])
      if (cancelled) return
      if (profileData) setPartner(profileData)
      setMessages(msgs)
      setLoading(false)
      // Mark received messages as read.
      await markConversationRead(currentUserId, partnerId)
    }

    load()
    return () => { cancelled = true }
  }, [currentUserId, partnerId])

  // Subscribe to new incoming messages in this conversation.
  useEffect(() => {
    const unsub = subscribeToDirectMessages(currentUserId, (msg) => {
      if (msg.sender_id !== partnerId) return
      setMessages((prev) => [...prev, msg])
      markConversationRead(currentUserId, partnerId)
    })
    return unsub
  }, [currentUserId, partnerId])

  // Scroll to bottom when messages change.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text || sending) return
    setSending(true)
    const sent = await sendMessage(currentUserId, partnerId, text)
    setSending(false)
    if (!sent) {
      toast.error('Failed to send message')
      return
    }
    setBody('')
    setMessages((prev) => [...prev, sent])
    onMessageSent()
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl+Enter submits; plain Enter adds a newline.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend(e as unknown as FormEvent)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
        <button
          onClick={onBack}
          className="md:hidden p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Back to messages"
        >
          <ArrowLeft size={18} />
        </button>
        {partner && (
          <Link
            to={`/users/${partner.id}`}
            className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity"
          >
            <Avatar profile={partner} size="sm" />
            <span className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">
              {partner.display_name}
            </span>
          </Link>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-8">
            Start the conversation.
          </p>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === currentUserId
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {!isMine && partner && (
                <img
                  src={partner.avatar_url || generateAvatar(partner.display_name)}
                  alt={partner.display_name}
                  className="w-6 h-6 rounded-full shrink-0 object-cover"
                />
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm break-words ${
                  isMine
                    ? 'bg-green-600 text-white rounded-br-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.body}</p>
                <p
                  className={`text-[10px] mt-1 ${
                    isMine ? 'text-green-200' : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {timeAgo(msg.created_at)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <form
        onSubmit={handleSend}
        className="flex items-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0"
      >
        <textarea
          ref={inputRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={1}
          maxLength={2000}
          className="flex-1 resize-none rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors max-h-32 overflow-y-auto"
          style={{ minHeight: '42px' }}
        />
        <button
          type="submit"
          disabled={!body.trim() || sending}
          className="shrink-0 w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
          aria-label="Send message"
        >
          {sending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </form>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user } = useAuth()
  const { userId: paramUserId } = useParams<{ userId?: string }>()
  const navigate = useNavigate()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConvs, setLoadingConvs] = useState(true)

  const loadConversations = useCallback(async () => {
    if (!user) return
    setLoadingConvs(true)
    const convs = await getConversations(user.id)
    setConversations(convs)
    setLoadingConvs(false)
  }, [user])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // When a new message arrives, refresh the conversations list.
  useEffect(() => {
    if (!user) return
    const unsub = subscribeToDirectMessages(user.id, () => {
      loadConversations()
    })
    return unsub
  }, [user, loadConversations])

  function handleSelect(userId: string) {
    navigate(`/messages/${userId}`)
  }

  function handleBack() {
    navigate('/messages')
  }

  if (!user) return null

  // Mobile: show only the list or only the conversation.
  // Desktop: split pane — list on left, conversation on right.

  const showList = !paramUserId
  const showConversation = !!paramUserId

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-screen overflow-hidden">
      {/* ── Left: Conversations list ── */}
      <div
        className={`
          flex flex-col w-full md:w-72 lg:w-80 shrink-0
          border-r border-gray-200 dark:border-gray-700
          bg-white dark:bg-gray-900
          ${showConversation ? 'hidden md:flex' : 'flex'}
        `}
      >
        <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Messages</h1>
        </div>
        <ConversationList
          conversations={conversations}
          loading={loadingConvs}
          selectedUserId={paramUserId}
          onSelect={handleSelect}
        />
      </div>

      {/* ── Right: Conversation thread ── */}
      {showConversation ? (
        <div className={`flex-1 flex flex-col ${showList ? 'hidden md:flex' : 'flex'}`}>
          <ConversationThread
            key={paramUserId}
            currentUserId={user.id}
            partnerId={paramUserId}
            onBack={handleBack}
            onMessageSent={loadConversations}
          />
        </div>
      ) : (
        // Desktop empty state when no conversation is selected.
        <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-3 text-center px-8">
          <MessageSquare size={40} className="text-gray-200 dark:text-gray-700" />
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Select a conversation
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Or visit a friend's profile to start a new one.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
