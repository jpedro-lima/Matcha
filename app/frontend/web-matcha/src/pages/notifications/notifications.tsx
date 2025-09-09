import { useState } from 'react'
import { NotificationsBoardCard } from './notifications-board-card'
import { NotificationsCard } from './notifications-card'

export interface CardData {
	id?: number
	title: string
	content: string
	timestamp: Date
	sendBy: string
}

const cardDataList: CardData[] = [
	{
		id: 0,
		title: 'Reunião de Equipe',
		content: 'Discutir os próximos passos do projeto X',
		timestamp: new Date('2023-10-05T14:30:00'),
		sendBy: 'system',
	},
	{
		id: 1,
		title: 'Lembretes Diários',
		content: 'Enviar relatório para o gestor até às 17h',
		timestamp: new Date('2023-10-05T14:30:00'),
		sendBy: 'system',
	},
	{
		id: 2,
		title: 'Aniversário',
		content: 'Comprar presente para a festa da Maria',
		timestamp: new Date('2023-11-15T00:00:00'),
		sendBy: 'system',
	},
	{
		id: 3,
		title: 'Manutenção',
		content: 'Levar o carro para revisão na concessionária',
		timestamp: new Date('2023-10-05T14:30:00'),
		sendBy: 'system',
	},
	{
		id: 4,
		title: 'Evento Importante',
		content: 'Conferência de Tecnologia às 09:00',
		timestamp: new Date('2025-06-10T09:35:00'),
		sendBy: 'system',
	},
	{
		id: 5,
		title:
			'teste timestamp teste timestamp teste timestamp teste timestamp teste timestamp',
		content:
			'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?',
		timestamp: new Date(),
		sendBy: 'system',
	},
]

export function Notifications() {
	const [activeCard, setActiveCard] = useState<CardData>()
	const { timeZone } = Intl.DateTimeFormat().resolvedOptions()

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
