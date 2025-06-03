import { Header } from '@/components/header'
import { Outlet } from 'react-router'

export function HomeLayout() {
	return (
		<div className="flex min-h-screen flex-col antialiased">
			<Header />
			<div className="flex flex-1 flex-col gap-4 p-8 pt-8">
				<Outlet />
			</div>
			<p>footer</p>
		</div>
	)
}
