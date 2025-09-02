import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CarouselImages } from '@/components/carousel-images'

import pretty from '@/_images/pretty-woman.jpg'
import photo from '@/_images/horizontal-photo.webp'
import woman from '@/_images/woman-peb.jpg'

const images = [
	{ url: pretty, size: 'sm:h-[625px]' },
	{ url: photo, size: '' },
	{ url: woman, size: 'sm:h-[625px]' },
	{ url: pretty, size: 'sm:h-[625px]' },
	{ url: photo, size: '' },
	{ url: woman, size: 'sm:h-[625px]' },
]

const formImagesInputSchema = z.object({
	images: z
		.custom<FileList>()
		.refine((files) => files?.length > 0, 'Selecione pelo menos uma imagem')
		.refine((files) => files?.length <= 5, 'Máximo de 5 imagens permitidas')
		.refine((files) => Array.from(files).every((file) => file.type.startsWith('image/'))),
})

type FormImagesInput = z.infer<typeof formImagesInputSchema>

export function CarouselForm() {
	const {
		handleSubmit,
		reset,
		watch,
		register,
		formState: { isSubmitting, errors },
	} = useForm<FormImagesInput>({
		resolver: zodResolver(formImagesInputSchema),
		defaultValues: {
			images: undefined,
		},
	})

	const selectedFiles = watch('images')

	async function onSubmit(values: FormImagesInput) {
		try {
			const formData = new FormData()
			Array.from(values.images).forEach((file) => {
				formData.append('images', file)
			})

			// Simulação de upload (substituir por API)
			await new Promise((resolve) => setTimeout(resolve, 1500))

			toast.success('Upload complete!', {
				description: `${values.images.length} image(s) successfully sent.`,
			})
			reset()
		} catch {
			console.error(errors.images?.message)
			toast.error('Upload Error', {
				description: 'An error occurred while sending the images.',
			})
		}
		console.log(selectedFiles)
	}

	return (
		<section className="mt-5">
			<CarouselImages images={images} />

			<form
				action=""
				onSubmit={handleSubmit(onSubmit)}
				className="mx-auto mt-5 flex w-8/12 gap-1"
			>
				<Input
					className="cursor-pointer rounded-l-md border border-rose-700"
					type="file"
					accept="image/*"
					multiple
					{...register('images')}
				/>

				<Button className="rounded-l-none" type="submit" disabled={isSubmitting}>
					<Upload size={32} className="size-6 text-neutral-100" />
				</Button>
			</form>
		</section>
	)
}
