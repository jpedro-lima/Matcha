import { Card, CardContent } from '@/components/ui/card'
import type { CardData } from './notifications'

export function NotificationsBoardCard({ title, content, timestamp }: CardData) {
	return (
		<Card className="h-[700px] w-[600px]">
			<CardContent>
				{title}
				{content}
				{timestamp.getTime()}
			</CardContent>
		</Card>
	)
}
