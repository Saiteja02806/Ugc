import { createHash } from "node:crypto";
import { crc32 } from "node:zlib";

export type BundleZipEntry = { name: string; size: number; sha256: string; open(): AsyncIterable<Uint8Array> };

export function bundleZipSize(entries: readonly BundleZipEntry[]) {
  if (!entries.length || entries.length > 200 || new Set(entries.map(entry => entry.name)).size !== entries.length) throw new Error("Invalid archive entries.");
  let size = 22;
  for (const entry of entries) {
    if (!/^Hook-\d{3}\.mp4$/.test(entry.name) || !Number.isSafeInteger(entry.size) || entry.size <= 0 ||
      entry.size > 64 * 1024 ** 2 || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error("Invalid archive entry.");
    size += entry.size + 30 + 16 + 46 + 2 * Buffer.byteLength(entry.name);
  }
  if (size > 2 * 1024 ** 3) throw new Error("The bundle exceeds its archive limit.");
  return size;
}

/** ZIP STORE format preserves original MP4 bytes with bounded memory. Hashes and
 * sizes are checked before the central directory is emitted. Cancellation closes
 * the current upstream iterator; the next file is never opened speculatively.
 */
export async function* streamBundleZip(entries: readonly BundleZipEntry[]) {
  bundleZipSize(entries);
  const directory: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const iterator = entry.open()[Symbol.asyncIterator]();
    let crc = 0, length = 0;
    const sha = createHash("sha256");
    try {
      // Make the first media read before yielding a header/admitting the download.
      let chunk = await iterator.next();
      if (chunk.done || !chunk.value.byteLength) throw new Error("A bundle video is unavailable.");
      const header = Buffer.alloc(30);
      header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x808, 6);
      header.writeUInt16LE(0x21, 12); header.writeUInt16LE(name.length, 26);
      yield Buffer.concat([header, name]);
      while (!chunk.done) {
        const bytes = Buffer.from(chunk.value);
        length += bytes.length;
        if (length > entry.size) throw new Error("A bundle video changed size.");
        crc = crc32(bytes, crc); sha.update(bytes);
        yield bytes;
        chunk = await iterator.next();
      }
      if (length !== entry.size || sha.digest("hex") !== entry.sha256) throw new Error("A bundle video failed verification.");
    } finally { await iterator.return?.(); }
    const descriptor = Buffer.alloc(16);
    descriptor.writeUInt32LE(0x08074b50); descriptor.writeUInt32LE(crc, 4);
    descriptor.writeUInt32LE(length, 8); descriptor.writeUInt32LE(length, 12);
    yield descriptor;
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x808, 8); central.writeUInt16LE(0x21, 14); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(length, 20); central.writeUInt32LE(length, 24); central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42); directory.push(Buffer.concat([central, name]));
    offset += 30 + name.length + length + 16;
  }
  const central = Buffer.concat(directory);
  yield central;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  yield end;
}
