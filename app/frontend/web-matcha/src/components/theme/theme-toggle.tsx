import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/theme/theme-provider'
import { useState } from 'react'

export function ThemeToggle() {
	const { setTheme } = useTheme()
	const [themeState, setThemeState] = useState('')

	function handleTheme() {
		if (themeState === 'light') {
			setThemeState('dark')
			setTheme('dark')
		} else {
			setThemeState('light')
			setTheme('light')
		}
	}

	return (
		<>
			{themeState === 'light' ? (
				<Button variant="outline" size="icon" onClick={handleTheme}>
					<Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:-rotate-90" />
				</Button>
			) : (
				<Button variant="outline" size="icon" onClick={handleTheme}>
					<Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
				</Button>
			)}
		</>
	)
}
