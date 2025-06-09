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
import { RoseMask } from '@/components/rose-mask'

export function MainLayout() {
	return (
		<div className="max-h-lvh max-w-lvw antialiased">
			<header className="flex w-full">
				<img
					src={matchaLogo}
					alt="rose"
					className="mx-auto mt-[-15px] mb-[-5px] size-22"
				/>

				<div className="absolute right-0 m-4 flex items-center gap-2">
					<ThemeToggle />
					<Button size="icon">
						<LogOut size={24} />
					</Button>
				</div>
			</header>
			<div className="flex h-[calc(100lvh-4.3rem)] w-lvw flex-col md:flex-row">
				<main className="h-[calc(100%-3rem)] w-full md:h-full">
					<Outlet />
					<RoseMask />
				</main>

				<nav className="text-muted-foreground flex h-12 items-center justify-center gap-5 md:h-full md:w-15 md:flex-col md:justify-end md:gap-3 md:pb-3">
					<NavLink
						to="/notifications"
						className={({ isActive }) => (isActive ? 'text-rose-700' : '')}
					>
						<CircleAlert size={30} />
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
			</div>
		</div>
	)
}
