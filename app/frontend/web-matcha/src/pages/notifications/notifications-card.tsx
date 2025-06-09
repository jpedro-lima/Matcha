import { Card, CardContent, CardHeader } from '@/components/ui/card'

type NotificationsCardType = {
	title: string
	content: string
	timestamp: Date
}

export function NotificationsCard({ title, content, timestamp }: NotificationsCardType) {
	return (
		<Card>
			<CardHeader className="font-markazi text-xl">Linkie</CardHeader>
			<CardContent></CardContent>
		</Card>
	)
}
