import { BrowserRouter } from 'react-router'
import './global.css'
import { Router } from './router'
import { ThemeProvider } from './components/theme/theme-provider'
import { Toaster } from 'sonner'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/react-query'

function App() {
	return (
		<ThemeProvider defaultTheme="system" storageKey="matcha-theme">
			<Toaster richColors />
			<QueryClientProvider client={queryClient}>
				<BrowserRouter>
					<Router />
				</BrowserRouter>
			</QueryClientProvider>
		</ThemeProvider>
	)
}

export default App
