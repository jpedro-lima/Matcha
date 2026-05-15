import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { ProfileFormType } from './profile'
import { Controller, type Control } from 'react-hook-form'

type FormRadioType = {
	options: string[]
	control: Control<ProfileFormType>
}

export function FormRadio({ options, control }: FormRadioType) {
	return (
		<div className="">
			<Label className="font-markazi text-muted-foreground text-xl">Your Gender</Label>
			<Controller
				name={'gender'}
				control={control}
				defaultValue=""
				render={({ field }) => (
					<RadioGroup
						onValueChange={field.onChange}
						value={field.value}
						className="ml-2 flex gap-4"
					>
						{options.map((item) => (
							<div key={item} className="flex items-center gap-2">
								<RadioGroupItem value={item} id={item} className="bg-background" />
								<Label htmlFor={item} className="font-markazi text-xl capitalize">
									{item}
								</Label>
							</div>
						))}
					</RadioGroup>
				)}
			/>
		</div>
	)
}
