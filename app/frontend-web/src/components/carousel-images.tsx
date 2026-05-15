import { Card, CardContent } from '@/components/ui/card'
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from '@/components/ui/carousel'

export type CarouselImagesType = {
	images: {
		url: string
		size: string
	}[]
}

export function CarouselImages({ images }: CarouselImagesType) {
	return (
		<Carousel className="m-5 sm:ml-20">
			<CarouselPrevious className="hidden sm:flex" />

			<CarouselContent className="h-[75vh] cursor-grab active:cursor-grabbing">
				{images.map(({ url, size }) => {
					return (
						<CarouselItem key={url}>
							<Card className="bg-muted m-0 flex h-full items-center justify-center overflow-hidden p-0">
								<CardContent>
									<img src={url} className={`rounded-md ${size} `} />
								</CardContent>
							</Card>
						</CarouselItem>
					)
				})}
			</CarouselContent>

			<CarouselNext className="hidden sm:flex" />
		</Carousel>
	)
}
