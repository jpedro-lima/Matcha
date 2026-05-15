import * as React from 'react'

import { cn } from '@/libs/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				'font-markazi text-xl tracking-wide placeholder:text-xl',
				'file:text-muted-foreground placeholder:text-muted-foreground selection:text-primary-muted flex h-9 w-full min-w-0 border-b border-b-rose-700 bg-transparent px-2 py-1 transition-[color] outline-none file:inline-flex file:h-7 file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',

				className,
			)}
			{...props}
		/>
	)
}

export { Input }
