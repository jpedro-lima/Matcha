import matchaLogo from '@/assets/matcha-logo.svg'

export function RoseMask() {
	return (
		<div className="absolute bottom-0 z-[-1] size-[380px] overflow-hidden">
			<div className="size-full">
				<img
					src={matchaLogo}
					className="relative bottom-[-45px] left-[-60px] size-[400px] scale-180 opacity-20"
				/>
			</div>
		</div>
	)
}
