import { ChatList } from './chat-list'

const chats = [
	{
		id: '1',
		full_name: 'João Silva',
		avatar_url: 'https://example.com/avatars/joao.jpg',
		last_message:
			"There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomised words which don't look even slightly believable. If you are going to use a passage of Lorem Ipsum, you need to be sure there isn't anything embarrassing hidden in the middle of text. ",
	},
	{
		id: '2',
		full_name: 'Maria Santos',
		avatar_url: 'https://example.com/avatars/maria.jpg',
		last_message:
			"There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomised words which don't look even slightly believable. If you are going to use a passage of Lorem Ipsum, you need to be sure there isn't anything embarrassing hidden in the middle of text. ",
	},
	{
		id: '3',
		full_name: 'Pedro Oliveira',
		avatar_url: 'https://example.com/avatars/pedro.jpg',
		last_message:
			"There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomised words which don't look even slightly believable. If you are going to use a passage of Lorem Ipsum, you need to be sure there isn't anything embarrassing hidden in the middle of text. ",
	},
	{
		id: '4',
		full_name: 'Ana Costa',
		avatar_url: 'https://example.com/avatars/ana.jpg',
		last_message:
			"There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomised words which don't look even slightly believable. If you are going to use a passage of Lorem Ipsum, you need to be sure there isn't anything embarrassing hidden in the middle of text. ",
	},
	{
		id: '5',
		full_name: 'Carlos Pereira',
		avatar_url: 'https://example.com/avatars/carlos.jpg',
		last_message:
			"There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomised words which don't look even slightly believable. If you are going to use a passage of Lorem Ipsum, you need to be sure there isn't anything embarrassing hidden in the middle of text. ",
	},
	{
		id: '6',
		full_name: 'Juliana Rodrigues',
		avatar_url: 'https://example.com/avatars/juliana.jpg',
		last_message:
			"There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomised words which don't look even slightly believable. If you are going to use a passage of Lorem Ipsum, you need to be sure there isn't anything embarrassing hidden in the middle of text. ",
	},
	{
		id: '7',
		full_name: 'Marcos Souza',
		avatar_url: 'https://example.com/avatars/marcos.jpg',
		last_message:
			"There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomised words which don't look even slightly believable. If you are going to use a passage of Lorem Ipsum, you need to be sure there isn't anything embarrassing hidden in the middle of text. ",
	},
	{
		id: '8',
		full_name: 'Fernanda Lima',
		avatar_url: 'https://example.com/avatars/fernanda.jpg',
		last_message:
			"There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomised words which don't look even slightly believable. If you are going to use a passage of Lorem Ipsum, you need to be sure there isn't anything embarrassing hidden in the middle of text. ",
	},
	{
		id: '9',
		full_name: 'Ricardo Alves',
		avatar_url: 'https://example.com/avatars/ricardo.jpg',
		last_message:
			"There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomised words which don't look even slightly believable. If you are going to use a passage of Lorem Ipsum, you need to be sure there isn't anything embarrassing hidden in the middle of text. ",
	},
	{
		id: '10',
		full_name: 'Amanda Ferreira',
		avatar_url: 'https://example.com/avatars/amanda.jpg',
		last_message:
			"There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomised words which don't look even slightly believable. If you are going to use a passage of Lorem Ipsum, you need to be sure there isn't anything embarrassing hidden in the middle of text. ",
	},
]

export function Chat() {
	return (
		<main className="grid h-full w-full md:grid-cols-[70%_30%]">
			<section className="flex bg-blue-200">
				<div className="h-full w-40 self-center bg-amber-200"></div>
			</section>
			<section className="sm:bg-muted flex flex-col overflow-scroll p-4">
				<ChatList chats={chats} />
			</section>
		</main>
	)
}
