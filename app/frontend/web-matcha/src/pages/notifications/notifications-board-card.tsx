import { Card, CardContent, CardTitle } from '@/components/ui/card'
import type { CardData } from './notifications'
import { format } from 'date-fns'
import { TZDate } from '@date-fns/tz'

interface NotificationsBoardCardType extends CardData {
	timeZone: string
}

export function NotificationsBoardCard({
	title,
	content,
	timestamp,
	timeZone,
}: NotificationsBoardCardType) {
	return (
		<Card className="bg-muted m-4 sm:h-[700px] sm:w-[600px]">
			<CardContent className="font-markazi flex h-full flex-col items-center text-xl">
				<CardTitle className="text-primary mb-2 text-center">
					<p>{title}</p>
				</CardTitle>
				<p className="h-full overflow-scroll">{content}</p>

				<span className="text-muted-foreground mt-2 self-end">
					{format(new TZDate(timestamp, timeZone), 'Pp')}
				</span>
			</CardContent>
		</Card>
	)
}
