import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FormCheckbox } from './form-checkbox'
import { FormRadio } from './form-radio'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormHoverCardTags } from './form-hover-card-tags'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { createProfile, type ProfilePayload } from '@/api/create-profile'

const gender = ['male', 'female', 'non-binary']

const profileFormSchema = z.object({
	bio: z
		.string()
		.max(500, 'Maximum 500 characters')
		.nonempty('Introduce yourself in your bio'),
	gender: z.string().nonempty('Select your gender identity'),
	preferenceGender: z
		.array(z.string())
		.min(1, 'Match preferences: Select at least one gender'),
	tags: z.array(z.string()).min(4, 'Select 5 or more tags'),
})

export type ProfileFormType = z.infer<typeof profileFormSchema>

const tags: string[] = [
	'rock',
	'music',
	'sertanejo',
	'jogos',
	'programação',
	'cinema',
	'tecnologia',
	'fotografia',
	'viagens',
	'culinária',
	'esportes',
	'futebol',
	'basquete',
	'natação',
	'yoga',
	'livros',
	'escrita',
	'arte',
	'pintura',
	'desenho',
	'dança',
	'teatro',
	'moda',
	'design',
	'arquitetura',
	'história',
	'ciência',
	'astronomia',
	'filosofia',
	'psicologia',
	'negócios',
	'empreendedorismo',
	'finanças',
	'política',
	'jardinagem',
	'animais',
	'cães',
	'gatos',
	'natureza',
	'camping',
	'aventura',
	'carros',
	'motos',
	'bicicletas',
	'games',
	'animes',
	'mangás',
	'colecionáveis',
	'artesanato',
	'meditação',
	'idiomas',
	'café',
	'vinhos',
	'cervejas',
	'festivais',
]

export function ProfileForm() {
	const [selectedTags, setSelectedTags] = useState<string[]>([])
	const token = localStorage.getItem('accessToken') || '' // JWT stored after login

	// Inline mutation
	const mutation = useMutation({
		mutationFn: (payload: ProfilePayload) => createProfile(payload, token),
		onSuccess: () => {
		toast.success('Profile created successfully!')
		},
		onError: () => {
		toast.error('Failed to create profile')
		},
	})

	const {
		handleSubmit,
		register,
		control,
		setValue,
		formState: { isSubmitting, errors },
	} = useForm<ProfileFormType>({
		resolver: zodResolver(profileFormSchema),
		defaultValues: {
		preferenceGender: [],
		tags: [],
		},
	})

	function handleRemoveTag(tag: string) {
		const newTags = selectedTags.filter((t) => t !== tag)
		setSelectedTags(newTags)
		setValue('tags', newTags as [string, ...string[]])
	}

	function handleAddTag(tag: string) {
		if (!selectedTags.includes(tag)) {
		const newTags = [...selectedTags, tag]
		setSelectedTags(newTags)
		setValue('tags', newTags as [string, ...string[]])
		}
	}

	function handleProfileForm(data: ProfileFormType) {
		mutation.mutate({
		bio: data.bio,
		gender: data.gender,
		preferred_gender: data.preferenceGender,
		birth_date: '1990-01-01', // make dynamic if needed
		search_radius: 50,
		tags: data.tags,
		attributes: { height: '180cm', occupation: 'Software Engineer' },
		looking_for: { relationship_type: 'long-term', interests: ['outdoor activities', 'tech'] },
		profile_photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
		})
	}

	const checkErrorsForm = () => {
		Object.values(errors).forEach((error) => {
		toast.error(error.message)
		})
	}

	return (
		<form
			onSubmit={handleSubmit(handleProfileForm)}
			className="mt-5 flex w-full flex-col gap-3 sm:ml-3"
		>
			<div>
				<Label htmlFor="bio" className="font-markazi text-muted-foreground text-xl">
					Bio
				</Label>
				<Textarea
					className="bg-background h-32 max-h-60 overflow-scroll"
					id="bio"
					{...register('bio')}
				/>
			</div>

			<FormRadio options={gender} control={control} />
			<FormCheckbox options={gender} control={control} />
			<FormHoverCardTags
				options={tags}
				selectedTags={selectedTags}
				handleAddTag={handleAddTag}
				handleRemoveTag={handleRemoveTag}
			/>

			<Button
				className="mt-3 size-12 cursor-pointer self-center"
				type="submit"
				disabled={isSubmitting}
				onClick={checkErrorsForm}
			>
				<ArrowRight className="size-8 text-neutral-100" />
			</Button>
		</form>
	)
}
