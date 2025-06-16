import { TZDate } from '@date-fns/tz'
import { formatDistanceToNow } from 'date-fns'

interface TimestampProps {
	timestamp: Date
	timeZone: string
	showFull: boolean
}

export function Timestamp({ timestamp, timeZone, showFull }: TimestampProps) {
	if (!showFull) return null

	return (
		<span className="text-muted-foreground whitespace-nowrap">
			{formatDistanceToNow(new TZDate(timestamp, timeZone), {
				addSuffix: true,
			})}
		</span>
	)
}
