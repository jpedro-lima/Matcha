import * as React from 'react'

import { cn } from '@/libs/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				'placeholder:text-muted-foreground font-markazi aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content w-full rounded-md border border-rose-700 bg-transparent px-3 py-2 text-xl shadow-xs transition-[color,box-shadow] outline-none placeholder:text-xl disabled:cursor-not-allowed disabled:opacity-50',
				className,
			)}
			{...props}
		/>
	)
}

export { Textarea }
