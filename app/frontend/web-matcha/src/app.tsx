import { BrowserRouter } from 'react-router'
import './global.css'
import { Router } from './router'
import { ThemeProvider } from './components/theme/theme-provider'
import { Toaster } from 'sonner'

function App() {
	return (
		<ThemeProvider defaultTheme="system" storageKey="matcha-theme">
			<Toaster richColors />
			<BrowserRouter>
				<Router />
			</BrowserRouter>
		</ThemeProvider>
	)
}

export default App
