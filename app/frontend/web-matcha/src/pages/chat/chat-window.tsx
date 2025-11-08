import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Mic, SendHorizonal } from 'lucide-react'
import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '@/libs/axios'
import { ChatMessage } from './chat-message'

interface Message {
	sender_id: number
	content: string
	timestamp: Date
}

interface ApiMessage {
	sender_id: number
	content: string
	sent_at: string
}

export function ChatWindow() {
	const [matchId, setMatchId] = useState<number | null>(null)
	const [senderId, setSenderId] = useState<number | null>(null)
	const [isConnected, setIsConnected] = useState(false)
	const [messages, setMessages] = useState<Message[]>([])
	const [messageInput, setMessageInput] = useState('')
	const wsRef = useRef<WebSocket | null>(null)

	// parse JWT from localStorage to extract user_id (sender)
	const parseJwt = (token: string | null) => {
		if (!token) return null
		try {
			const base64Url = token.split('.')[1]
			const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
			const jsonPayload = decodeURIComponent(
				atob(base64)
					.split('')
					.map(function (c) {
						return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
					})
					.join('')
			)
			return JSON.parse(jsonPayload)
		} catch {
			return null
		}
	}

	const connect = useCallback(() => {
		if (wsRef.current) {
			wsRef.current.close()
		}
		if (!matchId) return
		const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:8080/ws?match_id=${matchId}`)
		ws.onopen = () => {
			setIsConnected(true)
			console.log('Connected to WebSocket')
		}
		ws.onmessage = (event) => {
			const msg = JSON.parse(event.data)
			setMessages((prev) => [
				...prev,
				{
					sender_id: msg.sender_id,
					content: msg.content,
					timestamp: new Date(msg.sent_at.replace(' ', 'T')),
				},
			])
		}
		ws.onclose = () => {
			setIsConnected(false)
			console.log('Disconnected from WebSocket')
		}
		wsRef.current = ws
	}, [matchId])

	const loadMessagesAndConnect = useCallback(async (mId: number) => {
		setMatchId(mId)
		setMessages([])
		try {
			const res = await api.get(`/messages?match_id=${mId}`)
			const fetchedMessages = res.data.map((msg: ApiMessage) => ({
				sender_id: msg.sender_id,
				content: msg.content,
				timestamp: new Date(msg.sent_at.replace(' ', 'T')),
			}))
			setMessages(fetchedMessages)
		} catch (e) {
			console.error('Failed to load messages', e)
		}
		// connect websocket after loading history
		connect()
	}, [connect])

	const sendMessage = () => {
		if (!wsRef.current || !isConnected || !messageInput.trim()) return
		if (!senderId) return
		const payload = {
			match_id: matchId,
			sender_id: senderId,
			content: messageInput,
		}
		wsRef.current.send(JSON.stringify(payload))
		setMessageInput('')
	}

	useEffect(() => {
		// set sender id from token
		const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
		const payload = parseJwt(token)
		if (payload && payload.user_id) {
			setSenderId(Number(payload.user_id))
		}

		// If there is a last selected match in storage, load it
		const lastMatchId = localStorage.getItem('lastMatchId')
		if (lastMatchId) {
			loadMessagesAndConnect(Number(lastMatchId))
		}

		// Listen for match selection events dispatched by parent (chat.tsx)
		const handler = (e: Event) => {
			const detail = (e as CustomEvent)?.detail
			if (!detail || !detail.match_id) return
			const selectedId = Number(detail.match_id)
			loadMessagesAndConnect(selectedId)
		}

		window.addEventListener('match-select', handler as EventListener)
		return () => {
			if (wsRef.current) wsRef.current.close()
			window.removeEventListener('match-select', handler as EventListener)
		}
	}, [connect, loadMessagesAndConnect])

	return (
		<main className="bg-muted/80 mx-12 flex size-full flex-col gap-2 rounded-t-3xl rounded-r-3xl">
			<header className="flex w-full flex-col gap-3 p-4">
				<div className="flex items-center gap-3">
					<Skeleton className="size-12 rounded-full" />
					<p className="text-foreground font-markazi text-2xl">Chat</p>
				</div>
				<div className="border-muted-foreground w-full self-center overflow-scroll border-b" />
				</header>

			<section className="flex h-[66vh] flex-col gap-2 overflow-auto px-4">
				{messages.map((m, i) => (
					<ChatMessage key={i} text={m.content} variant={m.sender_id === senderId ? 'right' : 'left'} timestamp={m.timestamp} />
				))}
			</section>

			<footer className="px-2">
				<div className="dark:bg-muted bg-background flex w-full items-center rounded-full px-3 py-1">
					<Button className="rounded-full border-0" variant="outline" size="icon">
						<Mic className="text-primary size-5" />
					</Button>
					<Textarea
						value={messageInput}
						onChange={(e) => setMessageInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault()
								sendMessage()
							}
						}}
						className="h-auto max-h-12 min-h-10 resize-none border-0 shadow-none dark:bg-transparent"
						placeholder="Type a message..."
					/>
					<Button onClick={sendMessage} className="rounded-full border-0" variant="outline" size="icon" disabled={!isConnected}>
						<SendHorizonal className="text-primary size-5" />
					</Button>
				</div>
			</footer>
		</main>
	)
}
