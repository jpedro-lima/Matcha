import { Input } from '@/components/ui/input'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import googleLogo from '@/assets/google-logo.svg'
import { ResetPassword } from './reset-password'
import { useMutation } from '@tanstack/react-query'
import { signIn } from '@/api/sign-in'
import { useNavigate } from 'react-router'

const signInSchema = z.object({
	email: z.string().email(),
	password: z.string().nonempty('Please enter your password'),
})

type SignInForm = z.infer<typeof signInSchema>

export function SignIn() {
	const navigate = useNavigate()
	const {
		register,
		handleSubmit,
		formState: { isSubmitting },
	} = useForm<SignInForm>({
		resolver: zodResolver(signInSchema),
	})

	const { mutateAsync: authenticate } = useMutation({
		mutationFn: signIn,
		onSuccess: (data) => {
			console.log(data)
			toast.success('Login successful')
			localStorage.setItem('accessToken', data.token)
			navigate('/main')
		},
		onError: (error) => {
			const message = 'Login failed. Please check your credentials.'
			toast.error(message)
			console.error('Login error:', error)
		},
	})

	async function handleLogin(data: SignInForm) {
		try {
			await authenticate(data)
		} catch {
			// error already handled in onError
		}
	}

	return (
		<div className="grid h-full w-full md:grid-cols-2">
			<section className=""></section>

			<main className="md:bg-muted flex">
				<div className="mx-auto h-[30rem] w-80 md:my-auto md:ml-22 md:w-96">
					<form onSubmit={handleSubmit(handleLogin)} className="flex flex-col">
						<Input type="text" placeholder="Username" {...register('email')} />
						<Input type="password" placeholder="Password" {...register('password')} />
						<ResetPassword />

						<Button type="submit" disabled={isSubmitting} className="mt-6">
							Sign in
						</Button>
						<p className="my-1 text-center">or</p>
						<Button variant={'outline'}>
							<img src={googleLogo} alt="Google-logo" sizes="16x16" />
							Continue with Google
						</Button>
					</form>
				</div>
			</main>
		</div>
	)
}
