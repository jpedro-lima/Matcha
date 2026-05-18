import { Route, Routes } from 'react-router'
import { NotFound } from './pages/errors/404'
import { HomeLayout } from './pages/_layouts/home'
import { Register } from './pages/auth/register'
import { SignIn } from './pages/auth/sign-in'
import { ForgotPassword } from './pages/auth/forgot-password'
import { ResetPassword } from './pages/auth/reset-password'
import { MainLayout } from './pages/_layouts/main'
import { Notifications } from './pages/notifications/notifications'
import { Profile } from './pages/profile/profile'
import { Main } from './pages/main/main'
import { Chat } from './pages/chat/chat'
import { Search } from './pages/search/search'

export function Router() {
	return (
		<Routes>
			<Route element={<HomeLayout />}>
				<Route path="/" element={<SignIn />} />
				<Route path="/register" element={<Register />} />
				<Route path="/sign-in" element={<SignIn />} />
				<Route path="/forgot-password" element={<ForgotPassword />} />
				<Route path="/reset-password" element={<ResetPassword />} />
			</Route>

			<Route element={<MainLayout />}>
				<Route path="/notifications" element={<Notifications />} />
				<Route path="/profile" element={<Profile />} />
				<Route path="/main" element={<Main />} />
				<Route path="/chat" element={<Chat />} />
				<Route path="/search" element={<Search />} />
			</Route>

			<Route path="*" element={<NotFound />} />
		</Routes>
	)
}
