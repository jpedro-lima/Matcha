export type AccessPayload = {
	sub: string
	username: string
}

export type RefreshPayload = {
	sub: string
	jti: string
}
