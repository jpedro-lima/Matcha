type BioType = {
	text: string
}

export function Bio({ text }: BioType) {
	return (
		<div>
			<h3 className="font-markazi text-muted-foreground text-xl">Bio</h3>
			<p
				className="dark:bg-input/30 bg-background font-markazi text-foreground h-40 max-h-60 overflow-scroll rounded-lg border border-rose-700 px-3 py-2 text-xl"
				id="bio"
			>
				{text}
			</p>
		</div>
	)
}
