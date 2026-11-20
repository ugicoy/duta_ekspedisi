import { randomBytes } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Konfigurasi Cloudflare R2 belum lengkap di .env (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).",
    );
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export async function uploadDataUrlToR2(
  dataUrl: string,
  folder: "transit" | "pod",
  filePrefix: string,
): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrlBase = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");

  if (!bucketName || !publicUrlBase) {
    throw new Error(
      "R2_BUCKET_NAME atau R2_PUBLIC_URL belum diatur pada file .env.",
    );
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Format file foto tidak valid.");
  }

  const contentType = match[1];
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, "base64");

  const ext = contentType === "image/png" ? "png" : "jpg";
  const safePrefix = filePrefix.replace(/[^a-zA-Z0-9_-]/g, "_");
  const randomSuffix = randomBytes(4).toString("hex");
  const dateFolder = new Date().toISOString().slice(0, 10);
  const objectKey = `${folder}/${dateFolder}/${safePrefix}-${Date.now()}-${randomSuffix}.${ext}`;

  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return `${publicUrlBase}/${objectKey}`;
}
