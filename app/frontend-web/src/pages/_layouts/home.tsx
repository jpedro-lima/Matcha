import { Header } from '@/components/header'
import { RoseMask } from '@/components/rose-mask'
import { Outlet } from 'react-router'

export function HomeLayout() {
	return (
		<div className="flex max-h-lvh max-w-lvw flex-col overflow-hidden antialiased">
			<Header />
			<main className="h-lvh w-lvw">
				<Outlet />
				<RoseMask />
			</main>
			<footer className="font-markazi text-foreground fixed bottom-0 mb-2 self-center">
				Copyright &copy; {new Date().getFullYear()}
			</footer>
		</div>
	)
}
