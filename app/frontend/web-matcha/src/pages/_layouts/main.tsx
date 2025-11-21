import matchaLogo from '@/assets/matcha-logo.svg'
import { Outlet } from 'react-router'
import { NavLink } from 'react-router'
import {
	CircleAlert,
	Earth,
	MessageCircleHeart,
	CircleUserRound,
	LogOut,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Button } from '@/components/ui/button'
import { api } from '@/libs/axios'
import { useNavigate } from 'react-router'
import { useCallback } from 'react'
import { RoseMask } from '@/components/rose-mask'
import { useQuery } from '@tanstack/react-query'
import { getNotifications } from '@/api/notifications'

export function MainLayout() {
	const navigate = useNavigate()

	const { data: notifications } = useQuery({
		queryKey: ['notifications'],
		queryFn: getNotifications,
		refetchInterval: 5000,
	})

	const hasUnread = notifications?.some((n) => !n.read)

	const handleLogout = useCallback(async () => {
		const token = localStorage.getItem('accessToken')
		try {
			await api.post('/logout', null, {
				headers: token ? { Authorization: `Bearer ${token}` } : undefined,
			})
		} catch {
			// ignore server error for stateless logout
		}
		localStorage.removeItem('accessToken')
		navigate('/sign-in')
	}, [navigate])

	return (
		<div className="h-lvh w-lvw antialiased">
			<header className="flex h-[8vh] w-full">
				<img
					src={matchaLogo}
					alt="rose"
					className="mx-auto mt-[-15px] mb-[-10px] size-22"
				/>

				<div className="absolute right-0 m-4 flex items-center gap-2">
					<ThemeToggle />
					<Button size="icon" variant="outline" onClick={handleLogout} title="Logout">
						<LogOut size={24} />
					</Button>
				</div>
			</header>

			<section className="flex h-[92vh] w-full flex-col overflow-hidden sm:flex-row">
				<main className="h-full w-full sm:h-full">
					<Outlet />
				</main>

				<nav className="text-muted-foreground absolute bottom-0 flex h-12 items-center gap-5 self-center sm:relative sm:mb-5 sm:h-full sm:w-15 sm:flex-col sm:justify-end sm:gap-3">
					<NavLink
						to="/notifications"
						className={({ isActive }) => (isActive ? 'text-rose-700' : '')}
					>
						<div className="relative">
							<CircleAlert size={30} />
							{hasUnread && (
								<span className="absolute top-0 right-0 block h-3 w-3 rounded-full bg-red-600 ring-2 ring-white" />
							)}
						</div>
					</NavLink>

					<NavLink
						to="/chat"
						className={({ isActive }) => (isActive ? 'text-rose-700' : '')}
					>
						<MessageCircleHeart size={30} />
					</NavLink>

					<NavLink
						to="/main"
						className={({ isActive }) => (isActive ? 'text-rose-700' : '')}
					>
						<Earth size={30} />
					</NavLink>

					<NavLink
						to="/profile"
						className={({ isActive }) => (isActive ? 'text-rose-700' : '')}
					>
						<CircleUserRound size={30} />
					</NavLink>
				</nav>
			</section>
			<RoseMask />
		</div>
	)
}
