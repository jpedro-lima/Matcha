import matchaLogo from '@/assets/matcha-logo.svg'

export function Header() {
	return (
		<div>
			<div className="flex justify-between">
				<div className="m-1 flex">
					<img className="mx-[-10px] my-[-15px] size-22" src={matchaLogo} alt="rose" />
					<span className="font-updock mt-2 self-center text-4xl text-rose-600">
						Matcha
					</span>
				</div>

				{/* <div>
				<ul>
					<li>teste</li>
					<li>teste</li>
					<li>teste</li>
					<li>teste</li>
					</ul>
			</div> */}
			</div>
			<div className="m-auto w-[98%] border border-b-red-700" />
		</div>
	)
}
