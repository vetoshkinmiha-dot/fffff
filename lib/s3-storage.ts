import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as getPresignedUrl } from "@aws-sdk/s3-request-presigner";

function getEndpoint(): string | undefined {
  const endpoint = process.env.S3_ENDPOINT;
  return endpoint && endpoint.length > 0 ? endpoint : undefined;
}

const s3Client = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "",
    secretAccessKey: process.env.S3_SECRET_KEY || "",
  },
  endpoint: getEndpoint(),
  forcePathStyle: !!getEndpoint(),
});

const BUCKET = process.env.S3_BUCKET || "contractor-demo";

export { s3Client, BUCKET };

export async function uploadFile(
  file: Buffer,
  key: string,
  contentType?: string
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file,
      ContentType: contentType,
    })
  );

  if (process.env.S3_PUBLIC_URL) {
    return `${process.env.S3_PUBLIC_URL}/${key}`;
  }

  return key;
}

export async function deleteFile(key: string): Promise<void> {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
      })
    );
  } catch {
    // File may not exist, ignore
  }
}

export async function getFileUrl(key: string): Promise<string> {
  if (process.env.S3_PUBLIC_URL) {
    return `${process.env.S3_PUBLIC_URL}/${key}`;
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getPresignedUrl(s3Client, command, { expiresIn: 7 * 24 * 3600 });
}

export async function getSignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getPresignedUrl(s3Client, command, { expiresIn: 7 * 24 * 3600 });
}
