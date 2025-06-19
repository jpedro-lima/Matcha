import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

export function FormRadio() {
	return (
		<div className="">
			<Label className="font-markazi text-muted-foreground text-xl">Your Gender</Label>
			<RadioGroup className="ml-2 flex gap-4">
				<div className="flex items-center gap-2">
					<RadioGroupItem id="male" value="male" className="bg-background" />
					<Label htmlFor="male" className="font-markazi text-xl">
						Male
					</Label>
				</div>
				<div className="flex items-center gap-2">
					<RadioGroupItem id="female" value="female" className="bg-background">
						Female
					</RadioGroupItem>
					<Label htmlFor="female" className="font-markazi text-xl">
						Female
					</Label>
				</div>
				<div className="flex items-center gap-2">
					<RadioGroupItem id="non-binary" value="non-binary" className="bg-background">
						Non-binary
					</RadioGroupItem>
					<Label htmlFor="non-binary" className="font-markazi text-xl">
						Non-binary
					</Label>
				</div>
			</RadioGroup>
		</div>
	)
}
