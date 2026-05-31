import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	type HeadObjectCommandOutput,
	NotFound,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '../../config/env.js'

const credentials = {
	accessKeyId: env.S3_ACCESS_KEY,
	secretAccessKey: env.S3_SECRET_KEY,
}

const internalClient = new S3Client({
	endpoint: env.S3_ENDPOINT,
	region: env.S3_REGION,
	credentials,
	forcePathStyle: true,
	requestChecksumCalculation: 'WHEN_REQUIRED',
	responseChecksumValidation: 'WHEN_REQUIRED',
})

const signingClient = new S3Client({
	endpoint: env.S3_PUBLIC_URL,
	region: env.S3_REGION,
	credentials,
	forcePathStyle: true,
	requestChecksumCalculation: 'WHEN_REQUIRED',
	responseChecksumValidation: 'WHEN_REQUIRED',
})

const PUT_TTL_SECONDS = 5 * 60
const GET_TTL_SECONDS = 60 * 60

export async function presignPut(
	key: string,
	contentType: string,
	contentLength: number,
): Promise<{ uploadUrl: string; expiresAt: Date }> {
	const cmd = new PutObjectCommand({
		Bucket: env.S3_BUCKET,
		Key: key,
		ContentType: contentType,
		ContentLength: contentLength,
	})
	const uploadUrl = await getSignedUrl(signingClient, cmd, { expiresIn: PUT_TTL_SECONDS })
	return {
		uploadUrl,
		expiresAt: new Date(Date.now() + PUT_TTL_SECONDS * 1000),
	}
}

export async function presignGet(
	key: string,
	ttlSeconds = GET_TTL_SECONDS,
): Promise<string> {
	const cmd = new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key })
	return getSignedUrl(signingClient, cmd, { expiresIn: ttlSeconds })
}

export type HeadResult = {
	contentLength: number
	contentType: string
}

export async function head(key: string): Promise<HeadResult | null> {
	try {
		const res: HeadObjectCommandOutput = await internalClient.send(
			new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
		)
		return {
			contentLength: res.ContentLength ?? 0,
			contentType: res.ContentType ?? '',
		}
	} catch (err) {
		if (err instanceof NotFound) return null
		const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata
			?.httpStatusCode
		if (status === 404 || status === 403) return null
		throw err
	}
}

export async function getRange(key: string, bytes: number): Promise<Buffer> {
	const res = await internalClient.send(
		new GetObjectCommand({
			Bucket: env.S3_BUCKET,
			Key: key,
			Range: `bytes=0-${bytes - 1}`,
		}),
	)
	const stream = res.Body as NodeJS.ReadableStream | undefined
	if (!stream) throw new Error('S3 GetObject returned empty body')

	const chunks: Buffer[] = []
	for await (const chunk of stream) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
	}
	return Buffer.concat(chunks)
}

export async function deleteObject(key: string): Promise<void> {
	await internalClient.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
}
