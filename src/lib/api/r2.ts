import "server-only";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

interface R2Config {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  bucketName: string;
}

function getR2Config(): R2Config {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accessKeyId || !secretAccessKey || !endpoint || !bucketName) {
    throw new Error("Missing one or more required R2 environment variables.");
  }

  return {
    accessKeyId,
    secretAccessKey,
    endpoint: endpoint.replace(/\/$/, ""),
    bucketName,
  };
}

function createR2Client(config: R2Config) {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  const config = getR2Config();
  const client = createR2Client(config);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return getR2Url(key);
}

export function getR2Url(key: string): string {
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error("Missing R2_PUBLIC_URL environment variable.");
  }

  const sanitizedKey = key.replace(/^\//, "");
  return `${publicUrl.replace(/\/$/, "")}/${encodeURI(sanitizedKey)}`;
}
