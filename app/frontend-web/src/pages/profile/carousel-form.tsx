import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CarouselImages } from '@/components/carousel-images'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { uploadProfilePhotos } from '@/api/upload-image'
import { getMyProfile } from '@/api/get-profile'
import { env } from '@/env'

const formImagesInputSchema = z.object({
	images: z
		.custom<FileList>()
		.refine((files) => files?.length > 0, 'Selecione pelo menos uma imagem')
		.refine((files) => files?.length <= 5, 'Máximo de 5 imagens permitidas')
		.refine((files) => Array.from(files).every((file) => file.type.startsWith('image/'))),
})

type FormImagesInput = z.infer<typeof formImagesInputSchema>

export function CarouselForm() {
	const qc = useQueryClient()
	const { data } = useQuery({ queryKey: ['myProfile'], queryFn: getMyProfile, staleTime: 1000 * 60 })

	type MyProfileCache = { profile?: { profile_photos?: string[] } & Record<string, unknown> } & Record<string, unknown>

	const profilePhotos: { url: string; size: string }[] = (data?.profile?.profile_photos || []).map((u: string) => {
		const url = typeof u === 'string' && u.startsWith('/') ? `${env.VITE_API_URL.replace(/\/$/, '')}${u}` : u
		return { url, size: 'sm:h-[500px]' }
	})

	const {
		handleSubmit,
		reset,
		register,
		formState: { isSubmitting },
	} = useForm<FormImagesInput>({
		resolver: zodResolver(formImagesInputSchema),
		defaultValues: {
			images: undefined,
		},
	})


	const mutation = useMutation({
		mutationFn: (files: FileList) => uploadProfilePhotos(files),
		onSuccess: (data) => {
			// data should contain { profile_photos: string[] }
			toast.success('Upload complete!')
			// update cache immediately so ProfileForm sees new URLs
			qc.setQueryData(['myProfile'], (old: unknown) => {
				const o = (old as MyProfileCache) || { profile: {} }
				const next: MyProfileCache = { ...(o as MyProfileCache) }
				next.profile = next.profile ? { ...next.profile } : {}
				if (data && data.profile_photos) {
					next.profile.profile_photos = data.profile_photos
				}
				return next
			})
			reset()
		},
		onError: () => {
			toast.error('Upload Error')
		},
	})

	async function onSubmit(values: FormImagesInput) {
		if (!values.images) return
		mutation.mutate(values.images)
	}

	return (
		<section className="mt-5">
			<CarouselImages images={profilePhotos.length ? profilePhotos : [{ url: '/_images/pretty-woman.jpg', size: 'sm:h-[500px]' }]} />

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

				<Button className="rounded-l-none" type="submit" disabled={isSubmitting || mutation.status === 'pending'}>
					<Upload size={32} className="size-6 text-neutral-100" />
				</Button>
			</form>
		</section>
	)
}
