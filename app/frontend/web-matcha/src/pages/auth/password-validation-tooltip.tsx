import { Check, X } from 'lucide-react'

type PasswordValidationTooltipType = {
	password: string
}

export function PasswordValidationTooltip({ password }: PasswordValidationTooltipType) {
	const validationRules = [
		{ pattern: '^(?=.*[a-z])', text: 'Contains lowercase letter' },
		{ pattern: '^(?=.*[A-Z])', text: 'Contains uppercase letter' },
		{ pattern: '^(?=.*[0-9])', text: 'Contains number' },
		{ pattern: '^(?=.*[!@#$%^&*{}])', text: 'contains special character' },
	]

	return (
		<ul>
			{validationRules.map((rule, index) => {
				const isValid = password.match(new RegExp(rule.pattern))
				const Icon = isValid ? Check : X
				const iconClass = isValid ? 'text-green-500' : 'text-destructive'

				return (
					<li key={index} className="flex items-center gap-2">
						<Icon size={18} className={`inline ${iconClass}`} />
						<span>{rule.text}</span>
					</li>
				)
			})}
		</ul>
	)
}
