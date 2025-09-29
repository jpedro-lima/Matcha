import { CarouselImages } from '@/components/carousel-images'
import { HandHeart, HeartHandshake, HeartOff, MapPin, Minus, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSuggestedProfile, type SuggestedProfile } from '@/api/get-match'
import { swipeLike, type SwipeResponse } from '@/api/swipe'
import { unmatchByProfile } from '@/api/unmatch'
import { toast } from 'sonner'

// interface User {
// 	firstName: string
// 	lastName: string
// 	fame: number
// 	bio: string
// 	tags: string[]
// 	images: { url: string; size: string }[]
// 	location: {
// 		city: string
// 		latitude?: number
// 		longitude?: number
// 	}
// }

import pretty from '@/_images/pretty-woman.jpg'
import photo from '@/_images/horizontal-photo.webp'
import woman from '@/_images/woman-peb.jpg'
import { MainBio } from './main-bio'
import { MainTags } from './main-tags'

// Helper to map backend photo string into carousel entries (backend returns only first photo in profile_photos)
function buildImages(firstPhoto?: string) {
	const fallback = [
		{ url: pretty, size: 'sm:h-[500px]' },
		{ url: photo, size: '' },
		{ url: woman, size: 'sm:h-[625px]' },
	]
	if (!firstPhoto) return fallback
	return [
		{ url: firstPhoto, size: 'sm:h-[500px]' },
		...fallback.slice(1),
	]
}

interface DisplayProfile {
	id: number
	firstName: string
	lastName: string
	bio: string
	fame: number
	tags: string[]
	images: { url: string; size: string }[]
	location: { city: string }
}

export function Main() {
	const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : ''
	const [loading, setLoading] = useState(false)
		const [current, setCurrent] = useState<DisplayProfile | null>(null)
		const [queue, setQueue] = useState<DisplayProfile[]>([])
				const [lastMatchedProfileId, setLastMatchedProfileId] = useState<number | null>(null)
	const [error, setError] = useState<string | null>(null)

		const mapSuggested = (data: SuggestedProfile): DisplayProfile => ({
			id: data.id,
			firstName: 'Match',
			lastName: `#${data.id}`,
			bio: data.bio || 'No bio provided',
			fame: 0,
			tags: [],
			images: buildImages(data.profile_photos),
			location: { city: 'Nearby' },
		})

		const fetchOne = useCallback(async (): Promise<DisplayProfile | null> => {
			try {
				const data: SuggestedProfile = await getSuggestedProfile(token)
				return mapSuggested(data)
				} catch {
				return null
			}
		}, [token])

		const topUpQueue = useCallback(async (desired = 3) => {
			if (!token) return
			setLoading(true)
			try {
				const needed = Math.max(0, desired - queue.length)
				const promises = Array.from({ length: needed }, () => fetchOne())
				const results = (await Promise.all(promises)).filter(Boolean) as DisplayProfile[]
				if (results.length) setQueue(prev => [...prev, ...results])
			} finally {
				setLoading(false)
			}
		}, [fetchOne, queue.length, token])

		const advance = useCallback(() => {
			setQueue(prev => {
				const [, ...rest] = prev
				return rest
			})
		}, [])

		const prime = useCallback(async () => {
		if (!token) {
			setError('Missing auth token – please sign in.')
			return
		}
		setLoading(true)
		setError(null)
		try {
				// Fetch initial batch (4: current + 3 queued)
				const promises = Array.from({ length: 4 }, () => fetchOne())
				const results = (await Promise.all(promises)).filter(Boolean) as DisplayProfile[]
				if (!results.length) {
					setCurrent(null)
					setError('No profiles available')
					return
				}
				setCurrent(results[0])
				setQueue(results.slice(1))
				} catch (e: unknown) {
					let message = 'Failed to load profile'
					if (typeof e === 'object' && e !== null) {
						// Axios error shape
						const maybeResp = e as { response?: { data?: string } }
						if (maybeResp.response?.data) message = String(maybeResp.response.data)
						else if ('message' in e) message = String((e as { message?: string }).message || message)
					}
					setError(message)
			setCurrent(null)
		} finally {
			setLoading(false)
		}
		}, [fetchOne, token])

		useEffect(() => {
			prime()
		}, [prime])

		const showNext = useCallback(() => {
				setCurrent(queue[0] || null)
			advance()
			// Top up queue after advancing
			void topUpQueue(3)
		}, [advance, queue, topUpQueue])

		const handleLike = async () => {
			if (!current) return
			try {
				const res: SwipeResponse = await swipeLike(token, current.id)
						if (res.status.includes('created')) {
							toast.success('Like sent (pending)')
						setLastMatchedProfileId(null)
						} else if (res.status.includes('accepted')) {
							toast.success('It\'s a match!')
							// Use current.id as the target profile id; backend returns accepted when reciprocal
						setLastMatchedProfileId(current.id)
						} else {
							toast.message(res.status)
						}
				showNext()
			} catch {
				toast.error('Failed to like')
			}
		}

		const handleDislike = () => {
			toast.message('Skipped')
			showNext()
		}

	const images = useMemo(() => current?.images || buildImages(), [current])

	return (
		<main className="grid h-full w-full md:grid-cols-2">
			<section className="order-1 mt-2.5 self-center sm:order-0">
				{loading ? (
					<div className="flex h-[500px] items-center justify-center"><Loader2 className="size-12 animate-spin text-rose-700" /></div>
				) : current ? (
					<CarouselImages images={images} />
				) : (
					<div className="flex h-[500px] flex-col items-center justify-center gap-4 text-center">
						<p className="text-muted-foreground">{error || 'No profiles available right now.'}</p>
									<button onClick={prime} className="rounded bg-rose-700 px-4 py-2 text-white hover:bg-rose-800">Try again</button>
					</div>
				)}
			</section>

			<section className="sm:bg-muted flex flex-col overflow-hidden sm:ml-[4rem]">
				{current && (
					<div className="flex w-82 flex-col self-center p-4 sm:my-auto sm:ml-12 sm:w-9/12 sm:self-start">
						<header className="flex flex-col items-end">
							<h1 className="font-markazi text-muted-foreground text-3xl">{`${current.firstName} ${current.lastName} `}</h1>
							<Minus className="my-[-15px] mr-[-5px] size-8 text-rose-700" />

							<div className="font-markazi flex gap-4">
								<span className="flex items-center gap-1 text-xl">
									<MapPin size={18} className="text-rose-700" />
									{current.location.city}
								</span>
								<span className="flex items-center gap-1.5 text-xl">
									<HandHeart size={18} className="text-rose-700" />
									{current.fame}
								</span>
							</div>
						</header>

						<div className="flex flex-col gap-4">
							<MainBio text={current.bio} />
							<MainTags tags={current.tags} />
						</div>
					</div>
				)}
				<div className="flex justify-between align-bottom">
					<button
						onClick={handleDislike}
						disabled={loading || !current}
						className="mb-[-88px] ml-[-88px] size-44 rotate-45 bg-red-700 active:opacity-40 dark:bg-red-900 disabled:opacity-30"
						aria-label="Dislike"
					>
						<div className="mt-3 ml-[58px] h-1/3 w-1/3 rotate-[-45deg] p-2">
							<HeartOff className="text-muted size-12 dark:text-neutral-300" />
						</div>
					</button>
					<button
						onClick={handleLike}
						disabled={loading || !current}
						className="mr-[-88px] mb-[-88px] size-44 rotate-45 bg-emerald-600 active:opacity-40 dark:bg-emerald-900 disabled:opacity-30"
						aria-label="Like"
					>
						<div className="mt-[58px] ml-3 h-1/3 w-1/3 rotate-[-45deg] p-2">
							<HeartHandshake className="text-muted size-12 dark:text-neutral-300" />
						</div>
					</button>
				</div>
								{lastMatchedProfileId && (
							<div className="mx-auto mt-6">
								<button
									onClick={async () => {
										try {
													await unmatchByProfile(token, lastMatchedProfileId)
											toast.message('Match undone')
													setLastMatchedProfileId(null)
										} catch {
											toast.error('Failed to unmatch')
										}
									}}
									className="rounded border border-rose-700 px-4 py-2 text-sm text-rose-700 hover:bg-rose-700 hover:text-white dark:border-rose-400 dark:text-rose-400 dark:hover:bg-rose-400 dark:hover:text-neutral-900"
								>
									Undo last match
								</button>
							</div>
						)}
			</section>
		</main>
	)
}
