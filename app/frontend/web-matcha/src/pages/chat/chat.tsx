import { useEffect, useState } from 'react'
import { ChatWindow } from './chat-window'
import { api } from '@/libs/axios'

type MatchItem = {
	match_id: number
	other_user_id: number
	name?: string
	first_photo?: string
	status: string
}

export function Chat() {
	const [matches, setMatches] = useState<MatchItem[]>([])
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		const load = async () => {
			setLoading(true)
			try {
				const res = await api.get('/matches/list')
				setMatches(res.data || [])
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
		// notify ChatWindow
		window.dispatchEvent(new CustomEvent('match-select', { detail: { match_id: m.match_id } }))
	}

	return (
		<main className="grid h-full w-full md:grid-cols-[70%_30%]">
			<section className="flex flex-1 justify-center py-2">
				<ChatWindow />
			</section>

			<aside className="sm:bg-muted flex flex-col gap-2 overflow-auto p-4">
				{loading ? (
					<div>Loading...</div>
				) : matches.filter((m) => m.status === 'accepted').length === 0 ? (
					<div className="text-sm text-muted-foreground">No matches yet.</div>
				) : (
					<ul className="flex flex-col gap-2">
						{matches
							.filter((m) => m.status === 'accepted')
							.map((m) => (
								<li key={m.match_id}>
									<button
										onClick={() => selectMatch(m)}
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
		</main>
	)
}
