import { BrowserRouter } from 'react-router'
import './global.css'
import { Router } from './router'
import { ThemeProvider } from './components/theme/theme-provider'

function App() {
	return (
		<ThemeProvider defaultTheme="dark" storageKey="matcha-theme">
			<BrowserRouter>
				<Router />
			</BrowserRouter>
		</ThemeProvider>
	)
}

export default App
