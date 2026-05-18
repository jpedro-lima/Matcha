import { useEffect, useState } from 'react'
import { ChatWindow } from './chat-window'
import { api } from '@/libs/axios'
import { env } from '@/env'

type MatchItem = {
	match_id: number
	other_user_id: number
	name?: string
	first_photo?: string
	status: string
}

export function Chat() {
	const [matches, setMatches] = useState<MatchItem[]>([])
	const [selectedMatch, setSelectedMatch] = useState<MatchItem | null>(null)
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		const load = async () => {
			setLoading(true)
			try {
				const res = await api.get('/matches/list')
				const acceptedMatches = (res.data || []).filter(
					(match: MatchItem) => match.status === 'accepted',
				)
				setMatches(acceptedMatches)

				const lastMatchId = localStorage.getItem('lastMatchId')
				const lastMatch = acceptedMatches.find(
					(match: MatchItem) => String(match.match_id) === lastMatchId,
				)
				if (lastMatch) setSelectedMatch(lastMatch)
			} catch (e) {
				console.error('Failed loading matches', e)
			} finally {
				setLoading(false)
			}
		}
		load()
	}, [])

	const selectMatch = (m: MatchItem) => {
		localStorage.setItem('lastMatchId', String(m.match_id))
		setSelectedMatch(m)
	}

	return (
		<main className="grid h-full w-full md:grid-cols-[70%_30%]">
			<section className="flex flex-1 justify-center py-2">
				<ChatWindow selectedMatch={selectedMatch} />
			</section>

			<aside className="sm:bg-muted flex flex-col gap-2 overflow-auto p-4">
				{loading ? (
					<div>Loading...</div>
				) : matches.length === 0 ? (
					<div className="text-muted-foreground text-sm">No matches yet.</div>
				) : (
					<ul className="flex flex-col gap-2">
						{matches.map((m) => {
							const isSelected = selectedMatch?.match_id === m.match_id
							const photo = m.first_photo
								? `${env.VITE_API_URL}${m.first_photo}`
								: '/vite.svg'

							return (
								<li key={m.match_id}>
									<button
										onClick={() => selectMatch(m)}
										className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors ${
											isSelected ? 'bg-rose-100 text-rose-950' : 'hover:bg-muted'
										}`}
									>
										<img
											src={photo}
											alt={m.name || `User ${m.other_user_id}`}
											className="h-10 w-10 rounded-full object-cover"
										/>
										<div className="flex min-w-0 flex-col">
											<span className="truncate font-medium">
												{m.name || `User ${m.other_user_id}`}
											</span>
											<span className="text-muted-foreground text-xs">
												{isSelected ? 'Current chat' : `match #${m.match_id}`}
											</span>
										</div>
									</button>
								</li>
							)
						})}
					</ul>
				)}
			</aside>
		</main>
	)
}
