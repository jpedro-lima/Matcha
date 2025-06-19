import { Route, Routes } from 'react-router'
import { NotFound } from './pages/errors/404'
import { HomeLayout } from './pages/_layouts/home'
import { Register } from './pages/auth/register'
import { SignIn } from './pages/auth/sign-in'
import { MainLayout } from './pages/_layouts/main'
import { Notifications } from './pages/notifications/notifications'
import { Profile } from './pages/profile/profile'

export function Router() {
	return (
		<Routes>
			<Route element={<HomeLayout />}>
				<Route path="/" element={<p>home</p>} />
				<Route path="/register" element={<Register />} />
				<Route path="/sign-in" element={<SignIn />} />
			</Route>

			<Route element={<MainLayout />}>
				<Route path="/notifications" element={<Notifications />} />
				<Route path="/profile" element={<Profile />} />
				<Route path="/main" element={<p>Perfil</p>} />
				<Route path="/chat" element={<p>Perfil</p>} />
			</Route>

			<Route path="*" element={<NotFound />} />
		</Routes>
	)
}
