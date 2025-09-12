import { Input } from '@/components/ui/input'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PasswordValidationTooltip } from './password-validation-tooltip'
import googleLogo from '@/assets/google-logo.svg'
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { registerUser } from '@/api/register'

const registerSchema = z.object({
	username: z.string().nonempty('Please enter your username'),
	firstName: z.string().nonempty('Please enter your first name'),
	lastName: z.string().nonempty('Please enter your last name'),
	email: z.string().email(),
	password: z
		.string()
		.regex(
			new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*{}])'),
			'Password invalid, please use a stronger one',
		),
	validatePassword: z.string(),
})

type RegisterForm = z.infer<typeof registerSchema>

export function Register() {
	const {
		register,
		handleSubmit,
		watch,
		formState: { isSubmitting },
	} = useForm<RegisterForm>({
		resolver: zodResolver(registerSchema),
	})

	// Inside your Register component
		const { mutateAsync: registerMutation } = useMutation({
			mutationFn: registerUser,
			onSuccess: () => {
				toast.success('Registered successfully');
		},
		onError: (error) => {
			const message = 'Registration failed';
			toast.error(message);
			console.error('Registration error:', error)
		},
	});

	async function handleRegister(data: RegisterForm) {
		try {
		await registerMutation(data);
		} catch {
		// error already handled in onError
		}
	}

	const password = watch('password', '')

	return (
		<div className="grid h-full w-full md:grid-cols-2">
			<section className=""></section>

			<main className="md:bg-muted flex">
				<div className="mx-auto h-[30rem] w-80 md:my-auto md:ml-22 md:w-96">
					<form onSubmit={handleSubmit(handleRegister)} className="flex flex-col gap-1.5">
						<Input type="text" {...register('firstName')} placeholder="First Name" />
						<Input type="text" {...register('lastName')} placeholder="Last Name" />
						<Input type="text" {...register('username')} placeholder="Username" />
						<Input type="email" placeholder="E-mail" {...register('email')} />
						<Tooltip>
							<TooltipContent
								className="bg-muted text-foreground w-80 border"
								side="bottom"
							>
								<PasswordValidationTooltip password={password} />
							</TooltipContent>
							<TooltipTrigger autoFocus onFocus={Input} asChild>
								<Input type="password" {...register('password')} placeholder="Password" />
							</TooltipTrigger>
						</Tooltip>
						<Input
							type="password"
							{...register('validatePassword')}
							placeholder="Confirm your Password"
						/>

						<Button
							type="submit"
							disabled={isSubmitting}
							className="mt-6"
						>
							Register
						</Button>
						<p className="my-3 text-center">or</p>
						<Button variant={'outline'}>
							<img src={googleLogo} alt="Google-logo" sizes="16x16" />
							Register with Google
						</Button>
					</form>
				</div>
			</main>
		</div>
	)
}
