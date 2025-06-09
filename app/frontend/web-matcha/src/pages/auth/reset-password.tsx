import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogTrigger,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'

export function ResetPassword() {
	return (
		<div className="self-end">
			<AlertDialog>
				<AlertDialogTrigger className="text-muted-foreground cursor-pointer text-sm underline">
					Reset password
				</AlertDialogTrigger>

				<AlertDialogContent>
					<AlertDialogTitle>Enter your email to reset your password</AlertDialogTitle>

					<form action="">
						<Input type="email" placeholder="E-mail" />
					</form>
					<AlertDialogDescription>
						You’ll get an email with password reset instructions
					</AlertDialogDescription>

					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction>Continue</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
