import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

const bucket = process.env.S3_BUCKET;

// Streams a buffer up to the bucket and returns the public URL. Using
// @aws-sdk/lib-storage's Upload (instead of a raw PutObjectCommand) so large
// transcoded video buffers are sent as a multipart upload without us having
// to hand-roll chunking.
export async function uploadBuffer({ key, body, contentType }) {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    },
  });
  await upload.done();
  return `${process.env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
}

export async function deleteObject(key) {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

// Bucket key convention: evidence/<reportId>/<uuid>.<ext>. Extracted back out
// of a public URL so admin "permanently remove" can delete the S3 object too.
export function keyFromPublicUrl(url) {
  const base = process.env.S3_PUBLIC_BASE_URL.replace(/\/$/, "");
  if (!url.startsWith(base)) return null;
  return url.slice(base.length + 1);
}
