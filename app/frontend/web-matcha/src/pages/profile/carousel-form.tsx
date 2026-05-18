import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { uploadProfilePhotos } from '@/api/upload-image'
import { deleteProfilePhoto } from '@/api/delete-photo'
import { getMyProfile } from '@/api/get-profile'
import { env } from '@/env'

const formImagesInputSchema = z.object({
	images: z
		.custom<FileList>()
		.refine((files) => files?.length > 0, 'Select at least one image')
		.refine((files) => files?.length <= 5, 'Maximum 5 images')
		.refine(
			(files) => Array.from(files).every((file) => file.type.startsWith('image/')),
			'Only image files are allowed',
		),
})

type FormImagesInput = z.infer<typeof formImagesInputSchema>

type MyProfileCache = {
	profile?: { profile_photos?: string[] } & Record<string, unknown>
} & Record<string, unknown>

export function CarouselForm() {
	const qc = useQueryClient()
	const { data } = useQuery({ queryKey: ['myProfile'], queryFn: getMyProfile, staleTime: 1000 * 60 })

	const photos: string[] = (data?.profile?.profile_photos || []).map((u: string) => {
		return typeof u === 'string' && u.startsWith('/')
			? `${env.VITE_API_URL.replace(/\/$/, '')}${u}`
			: u
	})

	const { handleSubmit, reset, register, formState: { isSubmitting } } = useForm<FormImagesInput>({
		resolver: zodResolver(formImagesInputSchema),
		defaultValues: { images: undefined },
	})

	const uploadMutation = useMutation({
		mutationFn: (files: FileList) => uploadProfilePhotos(files),
		onSuccess: (data) => {
			toast.success('Photos uploaded!')
			qc.setQueryData(['myProfile'], (old: unknown) => {
				const o = (old as MyProfileCache) || { profile: {} }
				return { ...o, profile: { ...o.profile, profile_photos: data?.profile_photos } }
			})
			reset()
		},
		onError: () => toast.error('Upload failed'),
	})

	const deleteMutation = useMutation({
		mutationFn: (url: string) => deleteProfilePhoto(url),
		onSuccess: (data) => {
			toast.success('Photo removed')
			qc.setQueryData(['myProfile'], (old: unknown) => {
				const o = (old as MyProfileCache) || { profile: {} }
				return { ...o, profile: { ...o.profile, profile_photos: data?.profile_photos } }
			})
		},
		onError: () => toast.error('Failed to remove photo'),
	})

	function onSubmit(values: FormImagesInput) {
		if (!values.images) return
		uploadMutation.mutate(values.images)
	}

	// The raw URL stored in DB (without base) — used for the delete API call
	function rawUrl(fullUrl: string) {
		return fullUrl.replace(env.VITE_API_URL.replace(/\/$/, ''), '')
	}

	return (
		<section className="mt-5">
			{/* Photo grid */}
			<div className="mx-auto grid w-10/12 grid-cols-3 gap-2">
				{photos.length === 0 && (
					<div className="col-span-3 flex h-40 items-center justify-center rounded border border-dashed text-sm text-muted-foreground">
						No photos yet
					</div>
				)}
				{photos.map((url, i) => (
					<div key={url} className="relative group">
						<img
							src={url}
							alt={`Photo ${i + 1}`}
							className="h-28 w-full rounded object-cover"
						/>
						<button
							type="button"
							onClick={() => deleteMutation.mutate(rawUrl(url))}
							className="absolute top-1 right-1 hidden rounded bg-red-600 p-1 text-white group-hover:flex"
							title="Delete photo"
						>
							<Trash2 size={12} />
						</button>
					</div>
				))}
			</div>

			{photos.length < 5 && (
				<form onSubmit={handleSubmit(onSubmit)} className="mx-auto mt-4 flex w-8/12 gap-1">
					<Input
						className="cursor-pointer rounded-l-md border border-rose-700"
						type="file"
						accept="image/*"
						multiple
						{...register('images')}
					/>
					<Button
						className="rounded-l-none"
						type="submit"
						disabled={isSubmitting || uploadMutation.status === 'pending'}
					>
						<Upload size={16} className="text-neutral-100" />
					</Button>
				</form>
			)}
			{photos.length >= 5 && (
				<p className="mt-2 text-center text-xs text-muted-foreground">
					Maximum 5 photos reached. Delete one to upload another.
				</p>
			)}
		</section>
	)
}
