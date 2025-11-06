import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Mic, SendHorizonal } from 'lucide-react'
import { ChatMessage } from './chat-message'

export function ChatWindow() {
	return (
		<main className="bg-muted/80 mx-12 flex size-full flex-col gap-2 rounded-t-3xl rounded-r-3xl">
			<header className="flex w-full flex-col gap-3 p-4">
				<div className="flex items-center gap-3">
					<Skeleton className="size-12 rounded-full" />
					<p className="text-foreground font-markazi text-2xl">Kessely Pacek de Pontes</p>
				</div>
				<div className="border-muted-foreground w-full self-center overflow-scroll border-b" />
			</header>

			<section className="flex h-[66vh] flex-col gap-2 overflow-scroll px-4">
				<ChatMessage text="sdad" variant="left" timestamp={new Date()} />
				<ChatMessage text="sdad" variant="left" timestamp={new Date()} />
				<ChatMessage
					text="dasdasdasdsadsadas adasdasdadas asdasdasdasdas asdasdasasd adasd  asdasdasdasdasasdasdasdasdas asdasdasdasdas asdasdasdasdasasdasdasdasdas  "
					variant="right"
					timestamp={new Date()}
				/>
				<ChatMessage
					text="dasdasdasdsadsadas adasdasdadas asdasdasdasdas asdasdasasd adasd  asdasdasdasdasasdasdasdasdas asdasdasdasdas asdasdasdasdasasdasdasdasdas  "
					variant="right"
					timestamp={new Date()}
				/>
				<ChatMessage
					text="dasdasdasdsadsadas adasdasdadas asdasdasdasdas asdasdasasd adasd  asdasdasdasdasasdasdasdasdas asdasdasdasdas asdasdasdasdasasdasdasdasdas  "
					variant="right"
					timestamp={new Date()}
				/>
				<ChatMessage
					text="dasdasdasdsadsadas adasdasdadas asdasdasdasdas asdasdasasd adasd  asdasdasdasdasasdasdasdasdas asdasdasdasdas asdasdasdasdasasdasdasdasdas  "
					variant="right"
					timestamp={new Date()}
				/>
				<ChatMessage
					text="dasdasdasdsadsadas adasdasdadas asdasdasdasdas asdasdasasd adasd  asdasdasdasdasasdasdasdasdas asdasdasdasdas asdasdasdasdasasdasdasdasdas  "
					variant="right"
					timestamp={new Date()}
				/>
				<ChatMessage
					text="dasdasdasdsadsadas adasdasdadas asdasdasdasdas asdasdasasd adasd  asdasdasdasdasasdasdasdasdas asdasdasdasdas asdasdasdasdasasdasdasdasdas  "
					variant="right"
					timestamp={new Date()}
				/>
				<ChatMessage
					text="dasdasdasdsadsadas adasdasdadas asdasdasdasdas asdasdasasd adasd  asdasdasdasdasasdasdasdasdas asdasdasdasdas asdasdasdasdasasdasdasdasdas  "
					variant="right"
					timestamp={new Date()}
				/>
				<ChatMessage
					text="dasdasdasdsadsadas adasdasdadas asdasdasdasdas asdasdasasd adasd  asdasdasdasdasasdasdasdasdas asdasdasdasdas asdasdasdasdasasdasdasdasdas  "
					variant="left"
					timestamp={new Date()}
				/>
				<ChatMessage
					text="dasdasdasdsadsadas adasdasdadas asdasdasdasdas asdasdasasd adasd  asdasdasdasdasasdasdasdasdas asdasdasdasdas asdasdasdasdasasdasdasdasdas  "
					variant="left"
					timestamp={new Date()}
				/>
				<ChatMessage
					text="dasdasdasdsadsadas adasdasdadas asdasdasdasdas asdasdasasd adasd  asdasdasdasdasasdasdasdasdas asdasdasdasdas asdasdasdasdasasdasdasdasdas  "
					variant="right"
					timestamp={new Date()}
				/>
				<ChatMessage text="sdad" variant="left" timestamp={new Date()} />
				<ChatMessage text="sdad" variant="left" timestamp={new Date()} />
				<ChatMessage text="end" variant="left" timestamp={new Date()} />
			</section>

			<footer className="px-2">
				<div className="dark:bg-muted bg-background flex w-full items-center rounded-full px-3 py-1">
					<Button className="rounded-full border-0" variant="outline" size="icon">
						<Mic className="text-primary size-5" />
					</Button>
					<Textarea className="h-auto max-h-12 min-h-10 resize-none border-0 shadow-none dark:bg-transparent"></Textarea>
					<Button className="rounded-full border-0" variant="outline" size="icon">
						<SendHorizonal className="text-primary size-5" />
					</Button>
				</div>
			</footer>
		</main>
	)
}
