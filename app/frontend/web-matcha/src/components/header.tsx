import matchaLogo from '@/assets/matcha-logo.svg'
import { Button } from './ui/button'
import { ThemeToggle } from './theme/theme-toggle'
import { Link } from 'react-router'

export function Header() {
	return (
		<div>
			<div className="m-3 flex justify-between">
				<Link to="/">
					<div className="flex">
						<img className="mx-[-10px] my-[-15px] size-22" src={matchaLogo} alt="rose" />
						<span className="font-updock mt-2 hidden self-center text-4xl text-rose-700 md:inline">
							Matcha
						</span>
					</div>
				</Link>

				<div className="mr-3 flex gap-2 self-center">
					<ThemeToggle />
					<Link to="/register">
						<Button>Register</Button>
					</Link>
					<Link to="/sign-in">
						<Button>Sign-in</Button>
					</Link>
				</div>
			</div>
			<div className="mx-auto w-[98%] border border-b-red-700" />
		</div>
	)
}
