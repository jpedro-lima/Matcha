interface TitleWithEllipsisProps {
	title: string
	maxLength: number
	isActive: boolean
}

export function TitleWithEllipsis({
	title,
	maxLength,
	isActive,
}: TitleWithEllipsisProps) {
	const shouldTruncate = !isActive && title.length > maxLength
	const displayedTitle = shouldTruncate
		? `${title.substring(0, maxLength - 3)}...`
		: title

	return <p className={'font-bol text-xl leading-none'}>{displayedTitle}</p>
}
