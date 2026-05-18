import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchProfiles, type BrowseParams } from '@/api/browse'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HandHeart, Tag, Loader2 } from 'lucide-react'
import { env } from '@/env'

export function Search() {
	const [params, setParams] = useState<BrowseParams>({
		min_age: 18,
		max_age: 60,
		min_fame: 0,
		max_fame: 100,
		sort_by: 'fame',
		sort_dir: 'desc',
		tags: '',
	})
	const [submitted, setSubmitted] = useState(false)

	const { data: results = [], isFetching } = useQuery({
		queryKey: ['search', params],
		queryFn: () => searchProfiles(params),
		enabled: submitted,
	})

	function handleSearch(e: React.FormEvent) {
		e.preventDefault()
		localStorage.setItem('browseParams', JSON.stringify(params))
		setSubmitted(true)
	}

	return (
		<main className="flex h-full flex-col overflow-auto p-4 sm:p-8">
			<h1 className="font-markazi mb-4 text-3xl text-rose-700">Advanced Search</h1>

			<form onSubmit={handleSearch} className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
				<div>
					<Label className="text-xs">Min Age</Label>
					<Input
						type="number" min={18} max={99}
						value={params.min_age}
						onChange={(e) => setParams((p) => ({ ...p, min_age: Number(e.target.value) }))}
					/>
				</div>
				<div>
					<Label className="text-xs">Max Age</Label>
					<Input
						type="number" min={18} max={99}
						value={params.max_age}
						onChange={(e) => setParams((p) => ({ ...p, max_age: Number(e.target.value) }))}
					/>
				</div>
				<div>
					<Label className="text-xs">Min Fame</Label>
					<Input
						type="number" min={0} max={100}
						value={params.min_fame}
						onChange={(e) => setParams((p) => ({ ...p, min_fame: Number(e.target.value) }))}
					/>
				</div>
				<div>
					<Label className="text-xs">Max Fame</Label>
					<Input
						type="number" min={0} max={100}
						value={params.max_fame}
						onChange={(e) => setParams((p) => ({ ...p, max_fame: Number(e.target.value) }))}
					/>
				</div>
				<div className="col-span-2">
					<Label className="text-xs">Tags (comma-separated)</Label>
					<Input
						placeholder="e.g. music, yoga"
						value={params.tags}
						onChange={(e) => setParams((p) => ({ ...p, tags: e.target.value }))}
					/>
				</div>
				<div>
					<Label className="text-xs">Sort by</Label>
					<Select
						value={params.sort_by}
						onValueChange={(v) => setParams((p) => ({ ...p, sort_by: v as BrowseParams['sort_by'] }))}
					>
						<SelectTrigger><SelectValue /></SelectTrigger>
						<SelectContent>
							<SelectItem value="fame">Fame Rating</SelectItem>
							<SelectItem value="age">Age</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div>
					<Label className="text-xs">Direction</Label>
					<Select
						value={params.sort_dir}
						onValueChange={(v) => setParams((p) => ({ ...p, sort_dir: v as 'asc' | 'desc' }))}
					>
						<SelectTrigger><SelectValue /></SelectTrigger>
						<SelectContent>
							<SelectItem value="desc">Highest first</SelectItem>
							<SelectItem value="asc">Lowest first</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="col-span-2 flex items-end sm:col-span-4">
					<Button type="submit" className="w-full sm:w-auto" disabled={isFetching}>
						{isFetching ? <Loader2 className="animate-spin" size={16} /> : 'Search'}
					</Button>
				</div>
			</form>

			{submitted && (
				<>
					<p className="mb-3 text-sm text-muted-foreground">{results.length} result(s) found</p>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
						{results.map((p) => (
							<div key={p.id} className="rounded border bg-card overflow-hidden shadow-sm">
								<img
									src={
										p.profile_photos
											? `${env.VITE_API_URL.replace(/\/$/, '')}${p.profile_photos}`
											: '/placeholder.png'
									}
									alt="profile"
									className="h-36 w-full object-cover"
								/>
								<div className="p-2">
									<p className="text-sm font-medium line-clamp-2">{p.bio || '—'}</p>
									<div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
										<span className="flex items-center gap-0.5">
											<HandHeart size={12} className="text-rose-700" />
											{p.fame_rating}
										</span>
										{p.tags?.slice(0, 2).map((t) => (
											<span key={t} className="flex items-center gap-0.5">
												<Tag size={10} />
												{t}
											</span>
										))}
									</div>
								</div>
							</div>
						))}
					</div>
				</>
			)}
		</main>
	)
}
