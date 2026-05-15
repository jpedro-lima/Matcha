import { Badge } from '@/components/ui/badge'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Label } from '@/components/ui/label'

type FormHoverCardTagsType = {
	options: string[]
	selectedTags: string[]
	handleAddTag: (item: string) => void
	handleRemoveTag: (item: string) => void
}

export function FormHoverCardTags({
	selectedTags,
	options,
	handleAddTag,
	handleRemoveTag,
}: FormHoverCardTagsType) {
	return (
		<HoverCard>
			<HoverCardTrigger asChild>
				<div className="mt-0 min-h-8 w-full border-b border-b-rose-700 py-1">
					<Label className="font-markazi text-muted-foreground text-xl">
						Select your tags
					</Label>

					{selectedTags.map((tag) => {
						return (
							<Badge
								key={`selected-tag-${tag}`}
								onClick={() => handleRemoveTag(tag)}
								className="cursor-pointer"
							>
								#{tag}
							</Badge>
						)
					})}
				</div>
			</HoverCardTrigger>

			<HoverCardContent className="w-80 p-3 sm:w-[36rem]" id="hover-card">
				{options.map((tag) => {
					return (
						<Badge
							key={tag}
							onClick={() => handleAddTag(tag)}
							className="cursor-pointer"
							variant={selectedTags.includes(tag) ? 'outline' : 'default'}
						>
							#{tag}
						</Badge>
					)
				})}
			</HoverCardContent>
		</HoverCard>
	)
}
