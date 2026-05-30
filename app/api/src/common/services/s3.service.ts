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

const client = new S3Client({
	endpoint: env.S3_ENDPOINT,
	region: env.S3_REGION,
	credentials: {
		accessKeyId: env.S3_ACCESS_KEY,
		secretAccessKey: env.S3_SECRET_KEY,
	},
	forcePathStyle: true,
})

const PRESIGN_TTL_SECONDS = 5 * 60

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
	const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: PRESIGN_TTL_SECONDS })
	return {
		uploadUrl,
		expiresAt: new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000),
	}
}

export type HeadResult = {
	contentLength: number
	contentType: string
}

export async function head(key: string): Promise<HeadResult | null> {
	try {
		const res: HeadObjectCommandOutput = await client.send(
			new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
		)
		return {
			contentLength: res.ContentLength ?? 0,
			contentType: res.ContentType ?? '',
		}
	} catch (err) {
		if (err instanceof NotFound) return null
		throw err
	}
}

export async function getRange(key: string, bytes: number): Promise<Buffer> {
	const res = await client.send(
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
	await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
}

export function publicUrl(key: string): string {
	return `${env.S3_PUBLIC_URL}/${key}`
}
