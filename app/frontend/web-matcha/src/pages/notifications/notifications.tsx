import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { NotificationsBoardCard } from './notifications-board-card'
import { NotificationsCard } from './notifications-card'
import { getNotifications, markNotificationsRead } from '@/api/notifications'

export interface CardData {
	id?: number
	title: string
	content: string
	timestamp: Date
	sendBy: string
}

export function Notifications() {
	const [activeCard, setActiveCard] = useState<CardData>()
	const { timeZone } = Intl.DateTimeFormat().resolvedOptions()
	const queryClient = useQueryClient()

	const { data: notifications } = useQuery({
		queryKey: ['notifications'],
		queryFn: getNotifications,
	})

	const { mutate: markRead } = useMutation({
		mutationFn: markNotificationsRead,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['notifications'] })
		}
	})

	// Mark as read when component mounts
	useEffect(() => {
		markRead()
	}, [markRead])

	const cardDataList: CardData[] = (notifications || []).map(n => ({
		id: n.id,
		title: n.type.charAt(0).toUpperCase() + n.type.slice(1),
		content: n.content,
		timestamp: new Date(n.created_at),
		sendBy: 'System'
	}))

	return (
		<main className="grid h-full w-full md:grid-cols-[70%_30%]">
			<div className="hidden justify-center self-center sm:flex">
				{activeCard && (
					<NotificationsBoardCard
						title={activeCard.title}
						content={activeCard.content}
						timestamp={activeCard.timestamp}
						sendBy={activeCard.sendBy}
						timeZone={timeZone}
					/>
				)}
			</div>
			<div className="sm:bg-muted flex max-h-full flex-col gap-2.5 px-4 sm:overflow-scroll sm:py-4">
				{cardDataList.map((card) => {
					return (
						<NotificationsCard
							key={card.id}
							title={card.title}
							content={card.content}
							timestamp={card.timestamp}
							sendBy={card.sendBy}
							handleActiveCard={() => setActiveCard(card)}
							timeZone={timeZone}
						/>
					)
				})}
			</div>
		</main>
	)
}
