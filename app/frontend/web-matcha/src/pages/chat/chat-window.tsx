import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Mic, SendHorizonal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/libs/axios'
import { ChatMessage } from './chat-message'
import { env } from '@/env'

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

type SelectedMatch = {
	match_id: number
	other_user_id: number
	name?: string
	first_photo?: string
}

type ChatWindowProps = {
	selectedMatch: SelectedMatch | null
}

export function ChatWindow({ selectedMatch }: ChatWindowProps) {
	const [senderId, setSenderId] = useState<number | null>(null)
	const [isConnected, setIsConnected] = useState(false)
	const [messages, setMessages] = useState<Message[]>([])
	const [messageInput, setMessageInput] = useState('')
	const wsRef = useRef<WebSocket | null>(null)
	const selectedName =
		selectedMatch?.name || (selectedMatch ? `User ${selectedMatch.other_user_id}` : '')
	const selectedPhoto = selectedMatch?.first_photo
		? `${env.VITE_API_URL}${selectedMatch.first_photo}`
		: ''
	const canSend = Boolean(selectedMatch && isConnected && messageInput.trim())

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
					.join(''),
			)
			return JSON.parse(jsonPayload)
		} catch {
			return null
		}
	}

	const sendMessage = () => {
		if (!selectedMatch || !wsRef.current || !isConnected || !messageInput.trim()) return
		if (!senderId) return
		const payload = {
			match_id: selectedMatch.match_id,
			sender_id: senderId,
			content: messageInput,
		}
		wsRef.current.send(JSON.stringify(payload))
		setMessageInput('')
	}

	useEffect(() => {
		// set sender id from token
		const token =
			typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
		const payload = parseJwt(token)
		if (payload && payload.user_id) {
			setSenderId(Number(payload.user_id))
		}

		return () => {
			if (wsRef.current) wsRef.current.close()
		}
	}, [])

	useEffect(() => {
		if (wsRef.current) {
			wsRef.current.close()
			wsRef.current = null
		}
		setIsConnected(false)
		setMessages([])
		setMessageInput('')

		if (!selectedMatch) return

		let ignore = false
		const matchId = selectedMatch.match_id

		const loadMessages = async () => {
			try {
				const res = await api.get(`/messages?match_id=${matchId}`)
				if (ignore) return
				const fetchedMessages = res.data.map((msg: ApiMessage) => ({
					sender_id: msg.sender_id,
					content: msg.content,
					timestamp: new Date(msg.sent_at.replace(' ', 'T')),
				}))
				setMessages(fetchedMessages)
			} catch (e) {
				console.error('Failed to load messages', e)
			}
		}

		loadMessages()

		const ws = new WebSocket(
			`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:8080/ws?match_id=${matchId}`,
		)
		ws.onopen = () => {
			if (!ignore) setIsConnected(true)
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
			if (!ignore) setIsConnected(false)
		}
		wsRef.current = ws

		return () => {
			ignore = true
			ws.close()
		}
	}, [selectedMatch])

	// moderation actions
	const handleBlock = async () => {
		if (!selectedMatch) return
		try {
			await (await import('@/api/block')).blockUser(selectedMatch.other_user_id)
			// remove conversation from UI; simple approach: reload
			window.location.reload()
		} catch (e) {
			console.error('Failed to block user', e)
		}
	}

	const handleReport = async () => {
		if (!selectedMatch) return
		const reason = prompt(
			'Report reason (e.g. Sexual harassment, Bad behaviour, Spam):',
			'Bad behaviour',
		)
		if (!reason) return
		try {
			await (await import('@/api/report')).reportUser(selectedMatch.other_user_id, reason)
			alert('Report submitted')
			window.location.reload()
		} catch (e) {
			console.error('Failed to report user', e)
			alert('Could not submit report')
		}
	}

	return (
		<main className="bg-muted/80 mx-12 flex size-full flex-col gap-2 rounded-t-3xl rounded-r-3xl">
			<header className="flex w-full flex-col gap-3 p-4">
				<div className="flex items-center gap-3">
					{selectedPhoto ? (
						<img
							src={selectedPhoto}
							alt={selectedName}
							className="size-12 rounded-full object-cover"
						/>
					) : (
						<Skeleton className="size-12 rounded-full" />
					)}
					<div className="min-w-0">
						<p className="text-foreground font-markazi text-2xl">
							{selectedName || 'Choose a chat'}
						</p>
						<p className="text-muted-foreground text-xs">
							{selectedMatch
								? isConnected
									? 'Connected'
									: 'Connecting...'
								: 'Select someone from your matches'}
						</p>
					</div>
					<div className="ml-auto flex gap-2">
						<button
							onClick={handleReport}
							disabled={!selectedMatch}
							className="rounded-md bg-amber-500 px-3 py-1 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
						>
							Report
						</button>
						<button
							onClick={handleBlock}
							disabled={!selectedMatch}
							className="rounded-md bg-rose-600 px-3 py-1 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
						>
							Block
						</button>
					</div>
				</div>
				<div className="border-muted-foreground w-full self-center overflow-scroll border-b" />
			</header>

			<section className="flex h-[66vh] flex-col gap-2 overflow-auto px-4">
				{selectedMatch ? (
					messages.map((m, i) => (
						<ChatMessage
							key={`${m.sender_id}-${m.timestamp.getTime()}-${i}`}
							text={m.content}
							variant={m.sender_id === senderId ? 'right' : 'left'}
							timestamp={m.timestamp}
						/>
					))
				) : (
					<div className="text-muted-foreground flex h-full items-center justify-center text-center text-sm">
						Select a match to start chatting.
					</div>
				)}
			</section>

			<footer className="px-2">
				<div className="dark:bg-muted bg-background flex w-full items-center rounded-full px-3 py-1">
					<Button className="rounded-full border-0" variant="outline" size="icon">
						<Mic className="text-primary size-5" />
					</Button>
					<Textarea
						value={messageInput}
						onChange={(e) => setMessageInput(e.target.value)}
						disabled={!selectedMatch}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault()
								sendMessage()
							}
						}}
						className="h-auto max-h-12 min-h-10 resize-none border-0 shadow-none dark:bg-transparent"
						placeholder={
							selectedMatch ? `Message ${selectedName}...` : 'Choose a chat first'
						}
					/>
					<Button
						onClick={sendMessage}
						className="rounded-full border-0"
						variant="outline"
						size="icon"
						disabled={!canSend}
					>
						<SendHorizonal className="text-primary size-5" />
					</Button>
				</div>
			</footer>
		</main>
	)
}
