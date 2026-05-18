import { CarouselImages } from '@/components/carousel-images'
import { HandHeart, HeartHandshake, HeartOff, MapPin, Minus, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { browseProfiles, type BrowseProfile, type BrowseParams } from '@/api/browse'
import { swipeLike, type SwipeResponse } from '@/api/swipe'
import { unmatchByProfile } from '@/api/unmatch'
import { toast } from 'sonner'

import pretty from '@/_images/pretty-woman.jpg'
import photo from '@/_images/horizontal-photo.webp'
import woman from '@/_images/woman-peb.jpg'
import { MainBio } from './main-bio'
import { MainTags } from './main-tags'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080'

function buildImages(firstPhoto?: string) {
	const fallback = [
		{ url: pretty, size: 'sm:h-[500px]' },
		{ url: photo, size: '' },
		{ url: woman, size: 'sm:h-[625px]' },
	]
	if (!firstPhoto) return fallback
	const url = firstPhoto.startsWith('http') ? firstPhoto : `${API_URL}${firstPhoto}`
	return [{ url, size: 'sm:h-[500px]' }, ...fallback.slice(1)]
}

function loadSavedParams(): BrowseParams {
	try {
		const raw = localStorage.getItem('browseParams')
		if (raw) return JSON.parse(raw) as BrowseParams
	} catch {
		// ignore
	}
	return { min_age: 18, max_age: 99, min_fame: 0, max_fame: 100, sort_by: 'fame', sort_dir: 'desc', tags: '' }
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

function mapBrowse(data: BrowseProfile): DisplayProfile {
	return {
		id: data.id,
		firstName: 'Profile',
		lastName: `#${data.id}`,
		bio: data.bio || 'No bio provided',
		fame: data.fame_rating ?? 0,
		tags: data.tags ?? [],
		images: buildImages(data.profile_photos),
		location: { city: 'Nearby' },
	}
}

export function Main() {
	const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : ''
	const [loading, setLoading] = useState(false)
	const [current, setCurrent] = useState<DisplayProfile | null>(null)
	const [queue, setQueue] = useState<DisplayProfile[]>([])
	const [lastMatchedProfileId, setLastMatchedProfileId] = useState<number | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [activeFilters, setActiveFilters] = useState<BrowseParams>({})

	const prime = useCallback(async () => {
		if (!token) {
			setError('Missing auth token – please sign in.')
			return
		}
		setLoading(true)
		setError(null)
		const params = loadSavedParams()
		setActiveFilters(params)
		try {
			const data = await browseProfiles(params)
			if (!data.length) {
				setCurrent(null)
				setError('No profiles match your current filters. Try adjusting them in Search.')
				return
			}
			const profiles = data.map(mapBrowse)
			setCurrent(profiles[0])
			setQueue(profiles.slice(1))
		} catch (e: unknown) {
			let message = 'Failed to load profiles'
			if (typeof e === 'object' && e !== null) {
				const maybeResp = e as { response?: { data?: string } }
				if (maybeResp.response?.data) message = String(maybeResp.response.data)
				else if ('message' in e) message = String((e as { message?: string }).message || message)
			}
			setError(message)
			setCurrent(null)
		} finally {
			setLoading(false)
		}
	}, [token])

	useEffect(() => {
		prime()
	}, [prime])

	const showNext = useCallback(() => {
		if (queue.length > 0) {
			setCurrent(queue[0])
			setQueue((prev) => prev.slice(1))
		} else {
			setCurrent(null)
			prime()
		}
	}, [queue, prime])

	const resetFiltersAndPrime = useCallback(() => {
		localStorage.removeItem('browseParams')
		setActiveFilters({})
		prime()
	}, [prime])

	const handleLike = async () => {
		if (!current) return
		try {
			const res: SwipeResponse = await swipeLike(token, current.id)
			if (res.status.includes('created')) {
				toast.success('Like sent')
				setLastMatchedProfileId(null)
			} else if (res.status.includes('accepted')) {
				toast.success("It's a match!")
				setLastMatchedProfileId(current.id)
			} else {
				toast.message(res.status)
			}
			showNext()
		} catch (e: unknown) {
			const msg =
				(e as { response?: { data?: string } })?.response?.data?.trim() ||
				'Failed to like'
			toast.error(msg)
		}
	}

	const handleDislike = () => {
		toast.message('Skipped')
		showNext()
	}

	const images = useMemo(() => current?.images || buildImages(), [current])

	const hasFilters =
		activeFilters.tags ||
		(activeFilters.min_age && activeFilters.min_age !== 18) ||
		(activeFilters.max_age && activeFilters.max_age !== 99) ||
		(activeFilters.min_fame && activeFilters.min_fame !== 0) ||
		(activeFilters.max_fame && activeFilters.max_fame !== 100)

	return (
		<main className="grid h-full w-full md:grid-cols-2">
			<section className="order-1 mt-2.5 self-center sm:order-0">
				{loading ? (
					<div className="flex h-[500px] items-center justify-center">
						<Loader2 className="size-12 animate-spin text-rose-700" />
					</div>
				) : current ? (
					<CarouselImages images={images} />
				) : (
					<div className="flex h-[500px] flex-col items-center justify-center gap-4 text-center">
						<p className="text-muted-foreground">{error || 'No profiles available right now.'}</p>
						<button
							onClick={hasFilters ? resetFiltersAndPrime : prime}
							className="rounded bg-rose-700 px-4 py-2 text-white hover:bg-rose-800"
						>
							{hasFilters ? 'Reset filters' : 'Try again'}
						</button>
					</div>
				)}
			</section>

			<section className="sm:bg-muted flex flex-col overflow-hidden sm:ml-[4rem]">
				{hasFilters && (
					<p className="mx-auto mt-2 text-xs text-muted-foreground">
						Filters active — adjust in Search
					</p>
				)}
				{current && (
					<div className="flex w-82 flex-col self-center p-4 sm:my-auto sm:ml-12 sm:w-9/12 sm:self-start">
						<header className="flex flex-col items-end">
							<h1 className="font-markazi text-muted-foreground text-3xl">
								{`${current.firstName} ${current.lastName} `}
							</h1>
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
