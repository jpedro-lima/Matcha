import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { resetPassword } from '@/api/reset-password'
import { Link, useNavigate, useSearchParams } from 'react-router'

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })
type Form = z.infer<typeof schema>

export function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const { mutateAsync } = useMutation({
    mutationFn: (data: Form) => resetPassword(token, data.password),
    onSuccess: () => {
      toast.success('Password reset! You can now sign in.')
      navigate('/sign-in')
    },
    onError: () => toast.error('Invalid or expired link. Request a new one.'),
  })

  if (!token) {
    return (
      <main className="flex h-full w-full items-center justify-center">
        <div className="flex w-80 flex-col gap-4 text-center">
          <p className="text-muted-foreground">Invalid reset link.</p>
          <Link to="/forgot-password" className="text-rose-700 underline text-sm">Request a new one</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex h-full w-full items-center justify-center">
      <div className="flex w-80 flex-col gap-4">
        <h1 className="text-2xl font-semibold">Set new password</h1>
        <form onSubmit={handleSubmit((d) => mutateAsync(d))} className="flex flex-col gap-3">
          <Input type="password" placeholder="New password" {...register('password')} />
          {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
          <Input type="password" placeholder="Confirm new password" {...register('confirm')} />
          {errors.confirm && <p className="text-destructive text-xs">{errors.confirm.message}</p>}
          <Button type="submit" disabled={isSubmitting || !token}>Reset password</Button>
        </form>
      </div>
    </main>
  )
}
