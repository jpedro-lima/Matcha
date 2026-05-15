import googleLogo from '@/assets/google-logo.svg'
import matchaLogo from '@/assets/matcha-logo.svg'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { KeyRound, User } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

const signInSchema = z.object({
	email: z.string().email(),
	password: z.string().nonempty('Please enter your password'),
})

type SignInForm = z.infer<typeof signInSchema>

export function SignIn() {
	const {
		register,
		handleSubmit,
		formState: { isSubmitting, errors },
	} = useForm<SignInForm>({
		resolver: zodResolver(signInSchema),
	})

	function handleSignIn(data: SignInForm) {
		if (data.password) toast.success('Senha existe')
		else toast.error('Passwords not matching')
	}

	const checkErrorsForm = () => {
		Object.values(errors).forEach((error) => {
			toast.error(error.message)
		})
	}

	return (
		<main className="flex h-[80%] w-full items-center justify-center">
			<Card className="bg-muted absolute size-96 overflow-hidden">
				<form onSubmit={handleSubmit(handleSignIn)} className="z-1">
					<CardContent>
						<div className="flex justify-between">
							<Input
								id="email"
								type="email"
								placeholder="E-mail"
								{...register('email')}
							/>
							<Label htmlFor="email" className="border-b border-b-rose-700">
								<User size={24} className="text-muted-foreground" />
							</Label>
						</div>
						<div className="my-3 flex justify-between">
							<Input
								id="password"
								type="password"
								placeholder="Password"
								{...register('password')}
							/>
							<Label htmlFor="password" className="border-b border-b-rose-700">
								<KeyRound size={24} className="text-muted-foreground" />
							</Label>
						</div>
					</CardContent>
					<CardFooter className="flex flex-col">
						<Button
							type="submit"
							disabled={isSubmitting}
							onClick={checkErrorsForm}
							className="mt-6 w-full"
						>
							Sign in
						</Button>
						<p className="my-3 text-center">or</p>
						<Button variant={'outline'} className="w-full">
							<img src={googleLogo} alt="Google-logo" sizes="16x16" />
							Continue with Google
						</Button>
					</CardFooter>
				</form>

				<div className="absolute bottom-0 z-0 size-full overflow-hidden">
					<img
						src={matchaLogo}
						className="relative right-[-120px] bottom-[-100px] size-[400px] scale-180 opacity-20"
					/>
				</div>
			</Card>
		</main>
	)
}
