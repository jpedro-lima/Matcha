import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FormCheckbox } from './form-checkbox'
import { FormRadio } from './form-radio'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

const profileFormSchema = z.object({
	bio: z.string().nonempty(),
	gender: z.string().nonempty(),
	preferenceGender: z.array(z.string()).nonempty(),
	tags: z.array(z.string()).nonempty(),
})

type ProfileFormType = z.infer<typeof profileFormSchema>

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

export function Profile() {
	const {
		register,
		handleSubmit,
		watch,
		control,
		formState: { isSubmitting, errors },
	} = useForm<ProfileFormType>({ resolver: zodResolver(profileFormSchema) })

	const [mytags, setMyTags] = useState<string[]>([])

	function handleRemoveMyTags(tag: string) {
		setMyTags([...mytags.filter((item) => item !== tag)])
	}

	function handleAddMyTags(tag: string) {
		const tagExist = mytags.find((item) => item === tag) || false
		if (!tagExist) setMyTags([...mytags, tag])
	}

	return (
		<main className="grid h-full w-full md:grid-cols-2">
			<section className="hidden justify-end self-center sm:flex"></section>

			<section className="sm:bg-muted mt-2.5 flex flex-col p-4 sm:ml-[4rem]">
				<div className="flex w-84 self-center sm:my-auto sm:ml-4 sm:w-8/12 sm:self-start">
					<form action="" className="m-3 flex w-full flex-col gap-3">
						<div>
							<Label htmlFor="bio" className="font-markazi text-muted-foreground text-xl">
								Bio
							</Label>
							<Textarea className="h-32" id="bio" {...register('bio')} />
						</div>

						<FormRadio />

						<FormCheckbox control={control} />

						<HoverCard openDelay={0}>
							<HoverCardTrigger asChild>
								<div className="mt-0 min-h-8 w-full border-b border-b-rose-700 py-1">
									<Label className="font-markazi text-muted-foreground text-xl">
										Select your tags
									</Label>
									{mytags.map((item) => {
										return (
											<Badge
												key={`my-tag-${item}`}
												onClick={() => handleRemoveMyTags(item)}
											>
												#{item}
											</Badge>
										)
									})}
								</div>
							</HoverCardTrigger>

							<HoverCardContent className="w-80 p-3 sm:w-[36rem]" avoidCollisions>
								{tags.map((item) => {
									return (
										<Badge key={item} onClick={() => handleAddMyTags(item)}>
											#{item}
										</Badge>
									)
								})}
							</HoverCardContent>
						</HoverCard>
						<Button className="mt-3 size-12 self-center">
							<ArrowRight className="size-8 text-neutral-100" />
						</Button>
					</form>
				</div>
			</section>
		</main>
	)
}
