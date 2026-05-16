export type AppErrorDetails = unknown

export class AppError extends Error {
	public readonly code: string
	public readonly status: number
	public readonly details?: AppErrorDetails

	constructor(code: string, status: number, message: string, details?: AppErrorDetails) {
		super(message)
		this.name = 'AppError'
		this.code = code
		this.status = status
		this.details = details
	}
}

export const isAppError = (err: unknown): err is AppError => err instanceof AppError
