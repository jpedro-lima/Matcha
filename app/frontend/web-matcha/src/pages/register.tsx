import { Input } from '@/components/ui/input'
import { z } from 'zod'

const registerSchema = z.object({
	firstName: z.string(),
	lastName: z.string(),
	email: z.string().email(),
	password: z
		.string()
		.regex(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')),
})

type RegisterForm = z.infer<typeof registerSchema>

export function Register() {
	return (
		<div className="grid h-full w-full md:grid-cols-2">
			<div></div>

			<main className="md:bg-muted flex">
				<div className="mx-auto my-auto h-[480px] w-80 md:ml-22 md:w-96">
					<form action="" className="flex flex-col gap-1.5">
						<Input type="text" placeholder="First Name" />
						<Input type="text" placeholder="Last Name" />
						<Input type="email" placeholder="E-mail" />
						<Input type="password" placeholder="Password" />
						<Input type="password" placeholder="Confirm your Password" />
					</form>
				</div>
			</main>
		</div>
	)
}
