import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type ChatList = {
	chats: {
		id: string
		full_name: string
		avatar_url: string
		last_message: string
	}[]
}

export function ChatList({ chats }: ChatList) {
	return chats.map(({ full_name, last_message }) => {
		return (
			<Card>
				<CardContent className="flex gap-4">
					<Skeleton className="size-12 rounded-full" />
					<div>
						<p className="font-markazi text-xl">{full_name}</p>
						<p className="font-sans text-sm">
							{last_message.length > 40
								? last_message.substring(0, 40).concat('...')
								: last_message}
						</p>
					</div>
				</CardContent>
			</Card>
		)
	})
}
