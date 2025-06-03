import { Route, Routes } from 'react-router'
import { NotFound } from './pages/errors/404'
import { HomeLayout } from './pages/_layouts/home'

export function Router() {
	return (
		<Routes>
			<Route element={<HomeLayout />}>
				<Route path="/" element={<p>home</p>} />
			</Route>

			<Route path="*" element={<NotFound />} />
		</Routes>
	)
}
