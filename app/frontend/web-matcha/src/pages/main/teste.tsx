import { Checkbox } from '@/components/ui/checkbox'
import { Controller, type Control } from 'react-hook-form'

interface CheckboxFormProps {
	name: string
	label: string
	disabled?: boolean
	className?: string
	value: string
	control: Control
}

export function CheckboxForm({
	name,
	value,
	label,
	control,
	disabled = false,
	className = '',
}: CheckboxFormProps) {
	return (
		<Controller
			name={'selectedOptions'}
			control={control}
			render={({ field }) => {
				const isChecked = field.value.includes(value)
				return (
					<div className={`flex items-center space-x-2 ${className}`}>
						<Checkbox
							id={`${name}-${value}`}
							checked={isChecked}
							onCheckedChange={(checked) => {
								if (checked) {
									field.onChange([...field.value, value])
								} else {
									field.onChange(field.value.filter((v: string) => v !== value))
								}
							}}
							disabled={disabled}
						/>
						<label
							htmlFor={`${name}-${value}`}
							className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
						>
							{label}
						</label>
					</div>
				)
			}}
		/>
	)
}
