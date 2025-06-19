import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useState } from 'react'
import { useController, useWatch, type Control } from 'react-hook-form'

type FormCheckboxType = {
	control: Control
}

export function FormCheckbox({ control }: FormCheckboxType) {
	const {
		field: { ref, value, onChange, ...inputProps },
	} = useController({ name, control })

	const checkboxIds = useWatch({ control, name: name }) || []

	return (
		<div className="">
			<Label className="font-markazi text-muted-foreground text-xl">
				Sexual Preferences
			</Label>
			<ul className="ml-2 flex gap-4">
				<li className="flex items-center gap-2">
					<Checkbox id="preference-male" className="bg-background" />
					<Label htmlFor="preference-male" className="font-markazi text-xl">
						Male
					</Label>
				</li>
				<li className="flex items-center gap-2">
					<Checkbox id="preference-female" className="bg-background" />
					<Label htmlFor="preference-female" className="font-markazi text-xl">
						Female
					</Label>
				</li>
				<li className="flex items-center gap-2">
					<Checkbox id="preference-non-binary" className="bg-background" />
					<Label htmlFor="preference-non-binary" className="font-markazi text-xl">
						Non-binary
					</Label>
				</li>
			</ul>
		</div>
	)
}
