import { Badge } from '@/components/ui/badge'

type TagsType = {
	tags: string[]
}

export function Tags({ tags }: TagsType) {
	return (
		<div className="">
			{tags.map((tag) => {
				// return <p key={`selected-tag-${tag}`}>#{tag}</p>
				return (
					<Badge className="mb-1 text-sm" key={`selected-tag-${tag}`}>
						#{tag}
					</Badge>
				)
			})}
		</div>
	)
}
