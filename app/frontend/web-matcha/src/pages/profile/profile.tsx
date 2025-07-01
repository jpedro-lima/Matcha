import { CarouselForm } from './carousel-form'
import { ProfileForm } from './profile-form'
import { HandHeart, MapPin, Minus } from 'lucide-react'
import { getUserLocation, type LocationData } from '@/hooks/get-user-location'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'

export function Profile() {
	const { data: location, isLoading } = useQuery<LocationData>({
		queryKey: ['userLocation'],
		queryFn: getUserLocation,
		staleTime: Infinity,
	})

	return (
		<main className="grid h-full w-full md:grid-cols-2">
			<section className="order-1 mt-2.5 sm:order-0">
				<CarouselForm />
			</section>

			<section className="sm:bg-muted mt-2.5 flex flex-col p-4 sm:ml-[4rem]">
				<div className="flex w-82 flex-col self-center sm:my-auto sm:ml-4 sm:w-8/12 sm:self-start">
					<div className="flex flex-col items-end">
						<h1 className="font-markazi text-muted-foreground text-3xl">
							João Pedro Correia
						</h1>
						<Minus className="my-[-15px] mr-[-5px] size-8 text-rose-700" />
						<div className="font-markazi flex gap-4">
							<span className="flex items-center gap-1 text-xl">
								<MapPin size={18} className="text-rose-700" />
								{isLoading ? (
									<Skeleton className="bg-muted-foreground h-4 w-20" />
								) : (
									location?.city
								)}
							</span>
							<span className="flex items-center gap-1.5 text-xl">
								<HandHeart size={18} className="text-rose-700" />
								325
							</span>
						</div>
					</div>

					<ProfileForm />
				</div>
			</section>
		</main>
	)
}
