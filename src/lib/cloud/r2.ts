import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type R2Config = Readonly<{
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}>;

function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }
  return { accountId, accessKeyId, secretAccessKey, bucketName };
}

function requireR2() {
  const config = getR2Config();
  if (!config) {
    throw new Error("Private image storage is not configured yet.");
  }
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return { client, config };
}

export function createR2ObjectKey(ownerId: string, assetId: string, fileName: string) {
  const safeName = fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180) || "map-image";
  return `${ownerId}/${assetId}/${safeName}`;
}

export async function createR2UploadUrl(objectKey: string, mimeType: string) {
  const { client, config } = requireR2();
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
      ContentType: mimeType,
    }),
    { expiresIn: 5 * 60 },
  );
}

export async function createR2DownloadUrl(objectKey: string, mimeType: string) {
  const { client, config } = requireR2();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
      ResponseContentType: mimeType,
    }),
    { expiresIn: 5 * 60 },
  );
}

export async function readR2ObjectMetadata(objectKey: string) {
  const { client, config } = requireR2();
  return client.send(new HeadObjectCommand({ Bucket: config.bucketName, Key: objectKey }));
}

export async function readR2Object(objectKey: string) {
  const { client, config } = requireR2();
  const response = await client.send(new GetObjectCommand({
    Bucket: config.bucketName,
    Key: objectKey,
  }));
  if (!response.Body) {
    throw new Error("The private map image was empty.");
  }
  return Buffer.from(await response.Body.transformToByteArray());
}

export async function writeR2Object(objectKey: string, body: Uint8Array, mimeType: string) {
  const { client, config } = requireR2();
  await client.send(new PutObjectCommand({
    Bucket: config.bucketName,
    Key: objectKey,
    Body: body,
    ContentType: mimeType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
}

export async function deleteR2Object(objectKey: string) {
  const { client, config } = requireR2();
  await client.send(new DeleteObjectCommand({ Bucket: config.bucketName, Key: objectKey }));
}
