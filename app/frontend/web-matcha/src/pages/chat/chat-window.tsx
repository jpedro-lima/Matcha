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

type MatchItem = {
	match_id: number
	other_user_id: number
	profile_id?: number
	name?: string
	first_photo?: string
}

export function ChatWindow() {
	const [matchId, setMatchId] = useState<number | null>(null)
	const [senderId, setSenderId] = useState<number | null>(null)
	const [isConnected, setIsConnected] = useState(false)
	const [messages, setMessages] = useState<Message[]>([])
	const [messageInput, setMessageInput] = useState('')
	const wsRef = useRef<WebSocket | null>(null)
	const [matches, setMatches] = useState<MatchItem[]>([])
	const [loadingMatches, setLoadingMatches] = useState(false)

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
					timestamp: new Date(msg.sent_at),
				},
			])
		}
		ws.onclose = () => {
			setIsConnected(false)
			console.log('Disconnected from WebSocket')
		}
		wsRef.current = ws
	}, [matchId])

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

		// load current user id and matches
		const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
		const payload = parseJwt(token)
		if (payload && payload.user_id) {
			setSenderId(Number(payload.user_id))
		}

		const loadMatches = async () => {
			setLoadingMatches(true)
			try {
				const res = await api.get('/matches/list')
				setMatches(res.data || [])
				// Auto-select last match if exists, else first match
				const lastMatchId = localStorage.getItem('lastMatchId')
				let selectedMatch = null
				if (lastMatchId) {
					selectedMatch = res.data.find((m: MatchItem) => m.match_id == Number(lastMatchId))
				}
				if (!selectedMatch && res.data.length > 0) {
					selectedMatch = res.data[0]
					localStorage.setItem('lastMatchId', String(selectedMatch.match_id))
				}
				if (selectedMatch) {
					setMatchId(selectedMatch.match_id)
					// fetch messages
					try {
						const msgRes = await api.get(`/messages?match_id=${selectedMatch.match_id}`)
						const fetchedMessages = msgRes.data.map((msg: ApiMessage) => ({
							sender_id: msg.sender_id,
							content: msg.content,
							timestamp: new Date(msg.sent_at.replace(' ', 'T')),
						}))
						setMessages(fetchedMessages)
					} catch (e) {
						console.error('Failed to load messages', e)
					}
					// connect
					connect()
				}
			} catch (e) {
				console.error('Failed to load matches', e)
			} finally {
				setLoadingMatches(false)
			}
		}
		loadMatches()

		return () => {
			if (wsRef.current) {
				wsRef.current.close()
			}
		}
	}, [connect])

	return (
		<main className="bg-muted/80 mx-12 flex size-full flex-col gap-2 rounded-t-3xl rounded-r-3xl">
			<header className="flex items-center gap-3 p-4">
				<Skeleton className="size-12 rounded-full" />
				<p className="text-foreground font-markazi text-2xl">Chat</p>
			</header>
			<div className="flex h-[72vh]">
				{/* Left: matches list */}
				<aside className="w-72 border-r px-2 py-3 overflow-auto">
					{loadingMatches ? (
						<p>Loading...</p>
					) : matches.length === 0 ? (
						<p className="text-sm text-muted-foreground">No matches yet.</p>
					) : (
						<ul className="flex flex-col gap-2">
							{matches.map((m) => (
								<li key={m.match_id}>
									<button
										onClick={async () => {
											setMatchId(m.match_id)
											localStorage.setItem('lastMatchId', String(m.match_id))
											// ensure sender is current user (already set from token)
											const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
											const p = parseJwt(token)
											if (p && p.user_id) setSenderId(Number(p.user_id))
											// clear messages
											setMessages([])
											// fetch existing messages
											try {
												const res = await api.get(`/messages?match_id=${m.match_id}`)
												const fetchedMessages = res.data.map((msg: ApiMessage) => ({
													sender_id: msg.sender_id,
													content: msg.content,
													timestamp: new Date(msg.sent_at.replace(' ', 'T')),
												}))
												setMessages(fetchedMessages)
											} catch (e) {
												console.error('Failed to load messages', e)
											}
											// connect
											connect()
										}}
										className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted"
									>
										<img src={m.first_photo || '/vite.svg'} alt={m.name} className="h-10 w-10 rounded-full object-cover" />
										<div className="flex flex-col">
											<span className="font-medium">{m.name || `User ${m.other_user_id}`}</span>
											<span className="text-xs text-muted-foreground">match #{m.match_id}</span>
										</div>
									</button>
								</li>
							))}
						</ul>
					)}
				</aside>

				{/* Right: chat area */}
				<section className="flex-1 flex flex-col">
					<div className="border-b p-3">
						<div className="flex items-center gap-4">
							<div>
								<label className="text-sm">Match ID</label>
								<div className="font-mono">{matchId ?? '-'}</div>
							</div>
							<div>
								<label className="text-sm">You (sender)</label>
								<div className="font-mono">{senderId ?? '-'}</div>
							</div>
						</div>
					</div>
					<div className="flex-1 overflow-auto p-4">
						{messages.map((msg, index) => (
							<ChatMessage
								key={index}
								text={msg.content}
								variant={msg.sender_id === senderId ? 'right' : 'left'}
								timestamp={msg.timestamp}
							/>
						))}
					</div>
					<footer className="px-2 py-3">
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
							<Button
								onClick={sendMessage}
								className="rounded-full border-0"
								variant="outline"
								size="icon"
								disabled={!isConnected}
							>
								<SendHorizonal className="text-primary size-5" />
							</Button>
						</div>
					</footer>
				</section>
			</div>
		</main>
	)
}
