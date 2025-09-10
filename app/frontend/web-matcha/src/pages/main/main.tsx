import { CarouselImages } from '@/components/carousel-images'
import { HandHeart, HeartHandshake, HeartOff, MapPin, Minus } from 'lucide-react'

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

const perfil = {
	firstName: 'João Pedro',
	lastName: 'Correia',
	bio: 'Sou um desenvolvedor Full Stack Sou um desenvolvedor Full Stack especializado em Java com Spring Boot e React (quando não uso Vanilla JS), tenho domínio em docker e tenho experimentado o uso de Kubernetes para meus projetos de micro serviços.',
	fame: 355,
	tags: [
		'jogos',
		'programação',
		'cinema',
		'tecnologia',
		'fotografia',
		'viagens',
		'culinária',
		'esportes',
		'futebol',
		'viagens',
		'culinária',
	],
	images: [
		{ url: pretty, size: 'sm:h-[500px]' },
		{ url: photo, size: '' },
		{ url: woman, size: 'sm:h-[625px]' },
		{ url: pretty, size: 'sm:h-[625px]' },
		{ url: photo, size: '' },
		{ url: woman, size: 'sm:h-[625px]' },
	],
	location: {
		city: 'Barueri',
		latitude: -234243,
		longitude: 421312,
	},
}

export function Main() {
	return (
		<main className="grid h-full w-full md:grid-cols-2">
			<section className="order-1 mt-2.5 self-center sm:order-0">
				<CarouselImages images={perfil.images} />
			</section>

			<section className="sm:bg-muted flex flex-col overflow-hidden sm:ml-[4rem]">
				<div className="flex w-82 flex-col self-center p-4 sm:my-auto sm:ml-12 sm:w-9/12 sm:self-start">
					<header className="flex flex-col items-end">
						<h1 className="font-markazi text-muted-foreground text-3xl">{`${perfil.firstName} ${perfil.lastName} `}</h1>
						<Minus className="my-[-15px] mr-[-5px] size-8 text-rose-700" />

						<div className="font-markazi flex gap-4">
							<span className="flex items-center gap-1 text-xl">
								<MapPin size={18} className="text-rose-700" />
								{perfil.location.city}
							</span>
							<span className="flex items-center gap-1.5 text-xl">
								<HandHeart size={18} className="text-rose-700" />
								{perfil.fame}
							</span>
						</div>
					</header>

					<div className="flex flex-col gap-4">
						<MainBio text={perfil.bio} />
						<MainTags tags={perfil.tags} />
					</div>
				</div>
				<div className="flex justify-between align-bottom">
					<div className="mb-[-88px] ml-[-88px] size-44 rotate-45 bg-red-700 active:opacity-40 dark:bg-red-900">
						<div className="mt-3 ml-[58px] h-1/3 w-1/3 rotate-[-45deg] p-2">
							<HeartOff className="text-muted size-12 dark:text-neutral-300" />
						</div>
					</div>
					<div className="mr-[-88px] mb-[-88px] size-44 rotate-45 bg-emerald-600 active:opacity-40 dark:bg-emerald-900">
						<div className="mt-[58px] ml-3 h-1/3 w-1/3 rotate-[-45deg] p-2">
							<HeartHandshake className="text-muted size-12 dark:text-neutral-300" />
						</div>
					</div>
				</div>
			</section>
		</main>
	)
}
