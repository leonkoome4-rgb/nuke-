import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";

const execFileAsync = promisify(execFile);

let exiftoolAvailable;
async function isExiftoolAvailable() {
  if (exiftoolAvailable !== undefined) return exiftoolAvailable;
  try {
    await execFileAsync("exiftool", ["-ver"]);
    exiftoolAvailable = true;
  } catch {
    exiftoolAvailable = false;
    console.warn("[mediaProcessing] exiftool not found — document metadata will not be stripped");
  }
  return exiftoolAvailable;
}

let clamscanClient;
let clamscanInitAttempted = false;
async function getClamscanClient() {
  if (clamscanInitAttempted) return clamscanClient;
  clamscanInitAttempted = true;
  try {
    const { default: NodeClam } = await import("clamscan");
    clamscanClient = await new NodeClam().init({
      removeInfected: false,
      clamdscan: {
        host: process.env.CLAMAV_HOST || "localhost",
        port: Number(process.env.CLAMAV_PORT) || 3310,
        timeout: 60_000,
      },
      preference: "clamdscan",
    });
  } catch (err) {
    console.warn(`[mediaProcessing] virus scanning unavailable, skipping: ${err.message}`);
    clamscanClient = null;
  }
  return clamscanClient;
}

/**
 * Scans a file on disk. Returns { scanned: boolean, isInfected: boolean }.
 * If no scanner is reachable, scanned=false and the file is treated as
 * unscanned rather than blocked — degrade gracefully rather than failing
 * every upload when clamd isn't running (e.g. local dev).
 */
export async function scanFile(filePath) {
  const client = await getClamscanClient();
  if (!client) return { scanned: false, isInfected: false };
  try {
    const { isInfected } = await client.isInfected(filePath);
    return { scanned: true, isInfected: !!isInfected };
  } catch (err) {
    console.warn(`[mediaProcessing] scan failed, treating as unscanned: ${err.message}`);
    return { scanned: false, isInfected: false };
  }
}

/**
 * Strips EXIF/XMP/ICC metadata from an image and returns a re-encoded
 * buffer. `.rotate()` bakes in the correct visual orientation from the EXIF
 * orientation tag *before* that tag (and everything else) is dropped, so the
 * image doesn't end up sideways once metadata is gone.
 */
export async function processImage(inputPath) {
  const image = sharp(inputPath, { failOn: "none" });
  const metadata = await image.metadata();
  const format = ["jpeg", "png", "webp"].includes(metadata.format) ? metadata.format : "jpeg";

  const pipeline = image.rotate();
  const buffer =
    format === "jpeg"
      ? await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer()
      : format === "png"
        ? await pipeline.png({ compressionLevel: 8 }).toBuffer()
        : await pipeline.webp({ quality: 85 }).toBuffer();

  return { buffer, contentType: `image/${format}`, extension: format === "jpeg" ? "jpg" : format };
}

/**
 * Strips metadata (-map_metadata -1) and transcodes/compresses video to a
 * web-friendly H.264/AAC mp4, capped at 720p so evidence uploads don't bloat
 * storage. Runs against a temp output path because ffmpeg needs a seekable
 * file, not a stream, for this kind of multi-pass container muxing.
 */
export async function processVideo(inputPath, outputDir) {
  const outputPath = path.join(outputDir, `${path.parse(inputPath).name}-processed.mp4`);

  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        "-map_metadata", "-1",
        "-vf", "scale='min(1280,iw)':'-2'",
        "-crf", "28",
        "-preset", "veryfast",
        "-movflags", "+faststart",
      ])
      .on("error", reject)
      .on("end", resolve)
      .save(outputPath);
  });

  const buffer = await fs.readFile(outputPath);
  await fs.unlink(outputPath).catch(() => {});
  return { buffer, contentType: "video/mp4", extension: "mp4" };
}

/**
 * Best-effort metadata strip for arbitrary documents (PDF, DOCX, ...) via
 * exiftool. Falls back to returning the file untouched if exiftool isn't
 * installed — documents still upload, just without the metadata guarantee.
 */
export async function processDocument(inputPath, originalName, mimeType) {
  const extension = path.extname(originalName).replace(".", "") || "bin";

  if (await isExiftoolAvailable()) {
    const strippedPath = `${inputPath}.stripped`;
    try {
      await execFileAsync("exiftool", ["-all=", "-o", strippedPath, inputPath]);
      const buffer = await fs.readFile(strippedPath);
      await fs.unlink(strippedPath).catch(() => {});
      return { buffer, contentType: mimeType, extension };
    } catch (err) {
      console.warn(`[mediaProcessing] exiftool strip failed, uploading original: ${err.message}`);
    }
  }

  const buffer = await fs.readFile(inputPath);
  return { buffer, contentType: mimeType, extension };
}
