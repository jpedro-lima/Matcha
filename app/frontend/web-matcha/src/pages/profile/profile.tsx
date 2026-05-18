import { CarouselForm } from './carousel-form'
import { ProfileForm } from './profile-form'
import { HandHeart, MapPin, Minus, Eye, Heart } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { getMyProfile } from '@/api/get-profile'
import { getVisitors } from '@/api/visitors'
import { getLikers } from '@/api/likers'
import { env } from '@/env'
import { useState } from 'react'

type Tab = 'profile' | 'visitors' | 'likers'

export function Profile() {
	const [tab, setTab] = useState<Tab>('profile')
	const { data: myProfile, isLoading: profileLoading } = useQuery({
		queryKey: ['myProfile'],
		queryFn: getMyProfile,
		staleTime: 1000 * 60,
	})
	const { data: visitors = [] } = useQuery({ queryKey: ['visitors'], queryFn: getVisitors })
	const { data: likers = [] } = useQuery({ queryKey: ['likers'], queryFn: getLikers })

	const city = myProfile?.profile?.location
		? (() => {
				// location is WKT POINT(lon lat) — extract the coords and show "near you"
				const match = myProfile.profile.location.match(/POINT\(([^ ]+) ([^ )]+)\)/)
				if (match) return `${parseFloat(match[2]).toFixed(2)}°, ${parseFloat(match[1]).toFixed(2)}°`
				return 'Location set'
			})()
		: null

	return (
		<main className="grid h-full w-full md:grid-cols-2">
			<section className="order-1 mt-2.5 self-center sm:order-0">
				<CarouselForm />
			</section>

			<section className="sm:bg-muted flex flex-col overflow-y-auto p-4 sm:ml-[4rem]">
				<div className="flex w-82 flex-col self-center sm:ml-12 sm:w-8/12 sm:self-start">
					<header className="flex flex-col items-end">
						<h1 className="font-markazi text-muted-foreground text-3xl">
							{profileLoading ? (
								<Skeleton className="h-8 w-40" />
							) : myProfile ? (
								`${myProfile.first_name} ${myProfile.last_name}`
							) : (
								'Your Name'
							)}
						</h1>
						<Minus className="my-[-15px] mr-[-5px] size-8 text-rose-700" />
						<div className="font-markazi flex gap-4">
							{city && (
								<span className="flex items-center gap-1 text-xl">
									<MapPin size={18} className="text-rose-700" />
									{city}
								</span>
							)}
							<span className="flex items-center gap-1.5 text-xl">
								<HandHeart size={18} className="text-rose-700" />
								{myProfile?.profile?.fame_rating ?? 0}
							</span>
						</div>
					</header>

					{/* Tabs */}
					<div className="mt-4 flex gap-3 border-b">
						<button
							onClick={() => setTab('profile')}
							className={`pb-1 text-sm font-medium ${tab === 'profile' ? 'border-b-2 border-rose-700 text-rose-700' : 'text-muted-foreground'}`}
						>
							Profile
						</button>
						<button
							onClick={() => setTab('visitors')}
							className={`flex items-center gap-1 pb-1 text-sm font-medium ${tab === 'visitors' ? 'border-b-2 border-rose-700 text-rose-700' : 'text-muted-foreground'}`}
						>
							<Eye size={14} /> Visitors ({visitors.length})
						</button>
						<button
							onClick={() => setTab('likers')}
							className={`flex items-center gap-1 pb-1 text-sm font-medium ${tab === 'likers' ? 'border-b-2 border-rose-700 text-rose-700' : 'text-muted-foreground'}`}
						>
							<Heart size={14} /> Liked you ({likers.length})
						</button>
					</div>

					{tab === 'profile' && <ProfileForm />}

					{tab === 'visitors' && (
						<ul className="mt-4 flex flex-col gap-3">
							{visitors.length === 0 && (
								<p className="text-muted-foreground text-sm">No visitors yet.</p>
							)}
							{visitors.map((v) => (
								<li key={v.sender_id} className="flex items-center gap-3">
									<img
										src={
											v.first_photo
												? `${env.VITE_API_URL}${v.first_photo}`
												: '/placeholder.png'
										}
										alt={v.name}
										className="h-10 w-10 rounded-full object-cover"
									/>
									<div>
										<p className="text-sm font-medium">{v.name}</p>
										<p className="text-muted-foreground text-xs">
											{new Date(v.event_at).toLocaleDateString()}
										</p>
									</div>
								</li>
							))}
						</ul>
					)}

					{tab === 'likers' && (
						<ul className="mt-4 flex flex-col gap-3">
							{likers.length === 0 && (
								<p className="text-muted-foreground text-sm">No likes yet.</p>
							)}
							{likers.map((l) => (
								<li key={l.sender_id} className="flex items-center gap-3">
									<img
										src={
											l.first_photo
												? `${env.VITE_API_URL}${l.first_photo}`
												: '/placeholder.png'
										}
										alt={l.name}
										className="h-10 w-10 rounded-full object-cover"
									/>
									<div>
										<p className="text-sm font-medium">{l.name}</p>
										<p className="text-muted-foreground text-xs">
											{new Date(l.event_at).toLocaleDateString()}
										</p>
									</div>
								</li>
							))}
						</ul>
					)}
				</div>
			</section>
		</main>
	)
}
