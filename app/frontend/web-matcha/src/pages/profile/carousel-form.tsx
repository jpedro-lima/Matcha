import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from '@/components/ui/carousel'
import { Input } from '@/components/ui/input'
import { Upload } from 'lucide-react'

import pretty from '@/_images/pretty-woman.jpg'
import photo from '@/_images/horizontal-photo.webp'
import woman from '@/_images/woman-peb.jpg'

export function CarouselForm() {
	return (
		<main className="mt-5">
			<div>
				<Carousel className="m-5 sm:ml-20">
					<CarouselPrevious className="hidden sm:flex" />

					<CarouselContent className="h-[445px] cursor-grab active:cursor-grabbing sm:h-[700px]">
						{Array.from({ length: 4 }).map((_, index) => (
							<CarouselItem key={index}>
								<Card className="bg-muted m-0 flex h-full items-center justify-center p-0">
									<CardContent>
										{index % 2 ? (
											<img src={pretty} className="rounded-md sm:h-[625px]" />
										) : (
											<img src={photo} className="rounded-md" />
										)}
									</CardContent>
								</Card>
							</CarouselItem>
						))}
						<CarouselItem>
							<Card className="bg-muted flex h-full items-center justify-center">
								<CardContent>
									<img src={woman} className="rounded-md sm:h-[625px]" />
								</CardContent>
							</Card>
						</CarouselItem>
					</CarouselContent>

					<CarouselNext className="hidden sm:flex" />
				</Carousel>
			</div>
			<div className="mx-auto mt-5 flex w-8/12 gap-1">
				<Input
					className="cursor-pointer rounded-l-md border border-rose-700"
					id="picture"
					type="file"
					placeholder="teste"
					multiple
				/>
				<Button className="rounded-l-none" type="submit">
					<Upload size={32} className="size-6 text-neutral-100" />
				</Button>
			</div>
		</main>
	)
}
