import { useState } from 'react'
import { Timestamp } from '../../components/timestamp'

interface ChatMessageProps {
	text: string
	variant: 'left' | 'right'
	timestamp?: Date
	sender?: string
}

export function ChatMessage({ text, variant, sender, timestamp }: ChatMessageProps) {
	const [viewTimestamp, setViewTimestamp] = useState(false)
	const isRight = variant === 'right'
	const { timeZone } = Intl.DateTimeFormat().resolvedOptions()

	return (
		<div className={`flex ${isRight ? 'justify-end' : 'justify-start'} w-full`}>
			<div className={`flex max-w-3/5 flex-col ${isRight ? 'items-end' : 'items-start'}`}>
				{sender && !isRight && (
					<span className="mb-1 ml-2 text-xs text-gray-600">{sender}</span>
				)}
				<div
					className={`rounded-2xl px-4 py-2 text-neutral-100 shadow-sm ${
						isRight
							? 'rounded-br-none bg-rose-800'
							: 'dark:bg-muted bg-muted-foreground rounded-bl-none'
					} `}
					onMouseEnter={() => setViewTimestamp(true)}
					onMouseLeave={() => setViewTimestamp(false)}
				>
					<p className="text-sm break-words">{text}</p>
				</div>
				{viewTimestamp && timestamp && (
					<span className="mx-2 mt-1 text-xs text-gray-500">
						<Timestamp timestamp={timestamp} timeZone={timeZone} showFull={true} />
					</span>
				)}
			</div>
		</div>
	)
}
