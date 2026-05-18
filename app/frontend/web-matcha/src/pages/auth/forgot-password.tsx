import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { forgotPassword } from '@/api/forgot-password'
import { Link } from 'react-router'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
})
type Form = z.infer<typeof schema>

export function ForgotPassword() {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const { mutateAsync, isSuccess } = useMutation({
    mutationFn: (data: Form) => forgotPassword(data.email),
    onError: () => toast.error('Something went wrong. Try again.'),
  })

  async function onSubmit(data: Form) {
    await mutateAsync(data)
  }

  if (isSuccess) {
    return (
      <main className="flex h-full w-full items-center justify-center">
        <div className="flex w-80 flex-col gap-4 text-center">
          <h1 className="text-2xl font-semibold">Check your inbox</h1>
          <p className="text-muted-foreground text-sm">
            If that email exists in our system, a reset link was sent. Check spam if you don't see it.
          </p>
          <Link to="/sign-in" className="text-rose-700 underline text-sm">Back to sign in</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex h-full w-full items-center justify-center">
      <div className="flex w-80 flex-col gap-4">
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="text-muted-foreground text-sm">
          Enter your email and we'll send you a link to reset your password.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <Input type="email" placeholder="Email address" {...register('email')} />
          <Button type="submit" disabled={isSubmitting}>Send reset link</Button>
        </form>
        <Link to="/sign-in" className="text-muted-foreground text-sm underline text-center">Back to sign in</Link>
      </div>
    </main>
  )
}
