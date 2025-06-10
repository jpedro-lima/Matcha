import { Card, CardContent } from '@/components/ui/card'
import type { CardData } from './notifications'
// import { useState } from 'react'
// import { CheckCheck } from 'lucide-react'

interface NotificationsCardType extends CardData {
	handleActiveCard: () => void
}

export function NotificationsCard({
	title,
	content,
	handleActiveCard,
}: NotificationsCardType) {
	// const [viewed, setViewed] = useState<boolean>(false)

	// function handleClick() {
	// 	handleActiveCard()
	// 	setViewed(true)
	// }

	return (
		<Card onClick={handleActiveCard}>
			<CardContent className="break-all">
				<header className="font-markazi flex justify-between">
					{/* <div className="flex"> */}
					<p className="mr-1 text-xl font-bold">{title}</p>
					{/* {viewed ? <CheckCheck className="text-primary" size={18} /> : ''} */}
					{/* </div> */}
					<span>08:34</span>
				</header>
				<section className="text-sm">
					{content.length > 70 ? content.substring(0, 67).concat('...') : content}
				</section>
			</CardContent>
		</Card>
	)
}
