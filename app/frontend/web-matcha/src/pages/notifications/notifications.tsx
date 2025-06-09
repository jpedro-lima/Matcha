import { NotificationsCard } from './notifications-card'

export function Notifications() {
	return (
		<div className="grid h-full w-full gap-28 md:grid-cols-2">
			<div className="hidden md:inline"></div>
			<div className="md:bg-muted p-4">
				<NotificationsCard />
			</div>
		</div>
	)
}
