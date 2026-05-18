import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { FormCheckbox } from './form-checkbox'
import { FormRadio } from './form-radio'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowRight, MapPin, Loader2 } from 'lucide-react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormHoverCardTags } from './form-hover-card-tags'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createProfile, type ProfilePayload } from '@/api/create-profile'
import { useQuery } from '@tanstack/react-query'
import { getMyProfile } from '@/api/get-profile'
import { getUserLocation } from '@/hooks/get-user-location'

const gender = ['male', 'female', 'non-binary']

const profileFormSchema = z.object({
	bio: z
		.string()
		.max(500, 'Maximum 500 characters')
		.nonempty('Introduce yourself in your bio'),
	gender: z.string().nonempty('Select your gender identity'),
	preferenceGender: z.array(z.string()).min(1, 'Select at least one preference'),
	tags: z.array(z.string()).min(3, 'Select at least 3 tags'),
	birth_date: z.string().nonempty('Birth date is required'),
})

export type ProfileFormType = z.infer<typeof profileFormSchema>

const tags: string[] = [
	'rock',
	'music',
	'sertanejo',
	'games',
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
	'animes',
	'mangás',
	'meditação',
	'café',
	'vinhos',
	'cervejas',
	'festivais',
]

export function ProfileForm() {
	const queryClient = useQueryClient()
	const [selectedTags, setSelectedTags] = useState<string[]>([])
	const [location, setLocation] = useState<string>('')
	const [locationLabel, setLocationLabel] = useState<string>('')
	const [locLoading, setLocLoading] = useState(false)
	const [manualCity, setManualCity] = useState('')
	const [gpsDeclined, setGpsDeclined] = useState(false)
	const [isChangingLocation, setIsChangingLocation] = useState(false)

	const token = localStorage.getItem('accessToken') || ''
	const { data: myProfile } = useQuery({
		queryKey: ['myProfile'],
		queryFn: getMyProfile,
		staleTime: 1000 * 60,
	})

	const mutation = useMutation({
		mutationFn: (payload: ProfilePayload) => createProfile(payload, token),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['myProfile'] })
			toast.success('Profile saved!')
		},
		onError: (err: unknown) => {
			const msg =
				(err as { response?: { data?: string } })?.response?.data ||
				'Failed to save profile'
			toast.error(msg)
		},
	})

	const {
		handleSubmit,
		register,
		control,
		setValue,
		reset,
		formState: { isSubmitting, errors },
	} = useForm<ProfileFormType>({
		resolver: zodResolver(profileFormSchema),
		defaultValues: { preferenceGender: [], tags: [] },
	})

	useEffect(() => {
		const profile = myProfile?.profile
		if (!profile) return

		const savedTags = profile.tags ?? []
		const savedLocation = profile.location ?? ''

		reset({
			bio: profile.bio ?? '',
			gender: profile.gender ?? '',
			preferenceGender: profile.preferred_gender ?? [],
			tags: savedTags,
			birth_date: profile.birth_date ? profile.birth_date.slice(0, 10) : '',
		})
		setSelectedTags(savedTags)
		setLocation(savedLocation)
		setLocationLabel(formatLocationLabel(savedLocation))
	}, [myProfile, reset])

	function handleRemoveTag(tag: string) {
		const next = selectedTags.filter((t) => t !== tag)
		setSelectedTags(next)
		setValue('tags', next as [string, ...string[]])
	}

	function handleAddTag(tag: string) {
		if (!selectedTags.includes(tag)) {
			const next = [...selectedTags, tag]
			setSelectedTags(next)
			setValue('tags', next as [string, ...string[]])
		}
	}

	async function handleRequestGPS() {
		setLocLoading(true)
		try {
			const data = await getUserLocation()
			const wkt = `POINT(${data.coords.longitude} ${data.coords.latitude})`
			setLocation(wkt)
			setLocationLabel(
				data.city ||
					`${data.coords.latitude.toFixed(4)}, ${data.coords.longitude.toFixed(4)}`,
			)
			setGpsDeclined(false)
			setIsChangingLocation(false)
			toast.success('Location detected')
		} catch {
			setGpsDeclined(true)
			toast.error('GPS access denied. Enter your city manually.')
		} finally {
			setLocLoading(false)
		}
	}

	async function handleManualCity() {
		if (!manualCity.trim()) return
		setLocLoading(true)
		try {
			const res = await fetch(
				`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(manualCity)}&format=json&limit=1`,
			)
			const data = await res.json()
			if (data.length === 0) {
				toast.error('City not found. Try a different name.')
				return
			}
			const { lat, lon } = data[0]
			setLocation(`POINT(${lon} ${lat})`)
			setLocationLabel(manualCity)
			setManualCity('')
			setGpsDeclined(false)
			setIsChangingLocation(false)
			toast.success('Location set')
		} catch {
			toast.error('Failed to geocode city')
		} finally {
			setLocLoading(false)
		}
	}

	async function handleProfileForm(data: ProfileFormType) {
		if (!location) {
			toast.error('Please set your location before saving.')
			return
		}
		const photos = myProfile?.profile?.profile_photos ?? []
		const payload: ProfilePayload = {
			bio: data.bio,
			gender: data.gender,
			preferred_gender: data.preferenceGender,
			birth_date: data.birth_date,
			search_radius: 100,
			tags: data.tags,
			attributes: {},
			looking_for: {},
			profile_photos: photos,
			location,
		}
		mutation.mutate(payload)
	}

	function checkErrorsForm() {
		Object.values(errors).forEach((error) => {
			if (error?.message) toast.error(error.message)
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

			<div>
				<Label
					htmlFor="birth_date"
					className="font-markazi text-muted-foreground text-xl"
				>
					Birth Date
				</Label>
				<Input type="date" id="birth_date" {...register('birth_date')} />
			</div>

			{/* Location */}
			<div className="flex flex-col gap-2">
				<Label className="font-markazi text-muted-foreground text-xl">Location</Label>
				{locationLabel ? (
					<div className="flex items-center justify-between gap-2">
						<p className="flex items-center gap-1 text-sm text-rose-700">
							<MapPin size={14} /> {locationLabel}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setIsChangingLocation((value) => !value)}
						>
							{isChangingLocation ? 'Cancel' : 'Change'}
						</Button>
					</div>
				) : null}
				{(!locationLabel || isChangingLocation) && (
					<Button
						type="button"
						variant="outline"
						onClick={handleRequestGPS}
						disabled={locLoading}
					>
						{locLoading ? (
							<Loader2 className="animate-spin" size={14} />
						) : (
							<MapPin size={14} />
						)}
						<span className="ml-1">Allow GPS location</span>
					</Button>
				)}
				{(gpsDeclined || isChangingLocation || !locationLabel) && (
					<div className="flex gap-2">
						<Input
							placeholder="Enter your city"
							value={manualCity}
							onChange={(e) => setManualCity(e.target.value)}
						/>
						<Button
							type="button"
							variant="outline"
							onClick={handleManualCity}
							disabled={locLoading}
						>
							Set
						</Button>
					</div>
				)}
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
				disabled={isSubmitting || mutation.isPending}
				onClick={checkErrorsForm}
			>
				<ArrowRight className="size-8 text-neutral-100" />
			</Button>
		</form>
	)
}

function formatLocationLabel(location: string) {
	if (!location) return ''

	const match = location.match(/POINT\(([^ ]+) ([^ )]+)\)/)
	if (!match) return 'Location set'

	const longitude = Number.parseFloat(match[1])
	const latitude = Number.parseFloat(match[2])
	if (Number.isNaN(latitude) || Number.isNaN(longitude)) return 'Location set'

	return `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`
}
