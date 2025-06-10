import { useState } from 'react'
import { NotificationsBoardCard } from './notifications-board-card'
import { NotificationsCard } from './notifications-card'

export interface CardData {
	id?: number
	title: string
	content: string
	timestamp: Date
}

const cardDataList: CardData[] = [
	{
		id: 0,
		title: 'Reunião de Equipe',
		content: 'Discutir os próximos passos do projeto X',
		timestamp: new Date('2023-10-05T14:30:00'),
	},
	{
		id: 1,
		title: 'Lembretes Diários',
		content: 'Enviar relatório para o gestor até às 17h',
		timestamp: new Date('2023-10-05T14:30:00'),
	},
	{
		id: 2,
		title: 'Aniversário',
		content: 'Comprar presente para a festa da Maria',
		timestamp: new Date('2023-11-15T00:00:00'),
	},
	{
		id: 3,
		title: 'Manutenção',
		content: 'Levar o carro para revisão na concessionária',
		timestamp: new Date('2023-10-05T14:30:00'),
	},
	{
		id: 4,
		title: 'Evento Importante',
		content: 'Conferência de Tecnologia às 09:00',
		timestamp: new Date('2023-12-01T09:00:00'),
	},
]

export function Notifications() {
	const [activeCard, setActiveCard] = useState<CardData>()

	return (
		<div className="grid h-full w-full md:grid-cols-2">
			<div className="m-auto hidden md:inline">
				{activeCard ? (
					<NotificationsBoardCard
						title={activeCard.title}
						content={activeCard.content}
						timestamp={activeCard.timestamp}
					/>
				) : (
					<></>
				)}
			</div>
			<div className="md:bg-muted ml-[4rem] p-4">
				{cardDataList.map((card) => {
					return (
						<NotificationsCard
							key={card.id}
							title={card.title}
							content={card.content}
							timestamp={card.timestamp}
							handleActiveCard={() => setActiveCard(card)}
						/>
					)
				})}
			</div>
		</div>
	)
}
