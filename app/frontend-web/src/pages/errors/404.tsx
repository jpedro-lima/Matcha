import { Link } from 'react-router'

export function NotFound() {
	return (
		<div className="flex h-screen flex-col items-center justify-center gap-2">
			<h1 className="text-4xl font-bold">404</h1>
			<p className="text-lg font-medium">Página não encontrada</p>

			<p className="text-accent-foreground">
				Back to{' '}
				<Link className="text-sky-500 underline" to="/">
					home
				</Link>
			</p>
		</div>
	)
}
