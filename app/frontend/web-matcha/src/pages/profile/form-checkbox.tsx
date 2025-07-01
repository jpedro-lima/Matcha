import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { ProfileFormType } from './profile'
import { Controller, type Control } from 'react-hook-form'

type FormCheckboxType = {
	options: string[]
	control: Control<ProfileFormType>
}

export function FormCheckbox({ options, control }: FormCheckboxType) {
	return (
		<div className="">
			<Label className="font-markazi text-muted-foreground text-xl">
				Sexual Preferences
			</Label>

			<ul className="ml-2 flex gap-4">
				{options.map((item) => {
					return (
						<Controller
							key={`preference-${item}`}
							name="preferenceGender"
							control={control}
							render={({ field }) => {
								const isChecked = field.value.includes(item)
								return (
									<li className="flex items-center gap-2">
										<Checkbox
											id={`preference-${item}`}
											className="bg-background"
											checked={isChecked}
											onCheckedChange={(checked) => {
												if (checked) field.onChange([...field.value, item])
												else field.onChange(field.value.filter((v: string) => v !== item))
											}}
										/>
										<Label
											htmlFor={`preference-${item}`}
											className="font-markazi text-xl capitalize"
										>
											{item}
										</Label>
									</li>
								)
							}}
						/>
					)
				})}
			</ul>
		</div>
	)
}
