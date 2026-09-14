// Validate bytes, not client-supplied extensions or MIME headers. No executable/HTML/SVG formats.
export function sniffChatMedia(b: Buffer): string | null {
  if (b.length < 12) return null;
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png";
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  if (
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  if (
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WAVE"
  )
    return "audio/wav";
  if (b.toString("ascii", 0, 4) === "OggS") return "audio/ogg";
  if (
    b.toString("ascii", 0, 3) === "ID3" ||
    (b[0] === 255 && (b[1] & 224) === 224)
  )
    return "audio/mpeg";
  if (b.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])))
    return "video/webm";
  if (b.toString("ascii", 4, 8) === "ftyp") return "video/mp4";
  if (b.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  return null;
}
