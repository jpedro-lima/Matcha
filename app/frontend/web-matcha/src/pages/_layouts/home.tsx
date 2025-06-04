import { Header } from '@/components/header'
import { Outlet } from 'react-router'

export function HomeLayout() {
	return (
		<div className="flex max-h-lvh min-h-screen max-w-lvw flex-col antialiased">
			<Header />
			<main className="h-lvh w-lvw">
				<Outlet />
			</main>
			<footer className="font-markazi text-foreground fixed bottom-0 mb-2 self-center">
				Copyright &copy; {new Date().getFullYear()}
			</footer>
		</div>
	)
}
