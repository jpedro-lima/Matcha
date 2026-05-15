import { Card, CardContent } from '@/components/ui/card'
import type { CardData } from './notifications'
import { useState } from 'react'
import { TitleWithEllipsis } from './title-with-ellipsis'
import { Timestamp } from '../../components/timestamp'

interface NotificationsCardType extends CardData {
	handleActiveCard: () => void
	timeZone: string
}

export function NotificationsCard({
	title,
	content,
	timestamp,
	handleActiveCard,
	timeZone,
}: NotificationsCardType) {
	const [active, setActive] = useState<boolean>(false)

	function handleClick() {
		handleActiveCard()
		if (active) setActive(false)
		else setActive(true)
	}

	return (
		<Card onClick={handleClick}>
			<CardContent className="break-all">
				<header className="font-markazi">
					<div className="flex justify-between sm:hidden">
						<TitleWithEllipsis title={title} maxLength={28} isActive={active} />
						<Timestamp
							timestamp={timestamp}
							timeZone={timeZone}
							showFull={!active || title.length < 28}
						/>
					</div>
					<div className="hidden justify-between sm:flex">
						<TitleWithEllipsis title={title} maxLength={55} isActive={false} />
						<Timestamp timestamp={timestamp} timeZone={timeZone} showFull={true} />
					</div>
				</header>

				<section className="text-sm sm:hidden">
					{!active && content.length > 60
						? content.substring(0, 67).concat('...')
						: content}
				</section>
				<section className="hidden sm:inline">
					{content.length > 60 ? content.substring(0, 57).concat('...') : content}
				</section>
			</CardContent>
		</Card>
	)
}
