/* Photo metadata inspection and lossless removal for JPEG, PNG and WebP. Pure byte functions on Uint8Array
   (window.PhotoLogic / require). The image data itself is copied byte for byte: nothing is re-compressed. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PhotoLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ascii = (b, o, n) => { let s = ''; for (let i = 0; i < n && o + i < b.length; i++) s += String.fromCharCode(b[o + i]); return s; };
  const startsWith = (b, o, str) => ascii(b, o, str.length) === str;

  function detectType(b) {
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
    if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png';
    if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp';
    if (b.length >= 12 && ascii(b, 4, 4) === 'ftyp' && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|avif)$/.test(ascii(b, 8, 4))) return 'heif';
    if (b.length >= 6 && /^GIF8[79]a$/.test(ascii(b, 0, 6))) return 'gif';
    return 'unknown';
  }

  /* ---------------- TIFF / EXIF ---------------- */
  const TAGS = {
    0x010e: 'ImageDescription', 0x010f: 'Make', 0x0110: 'Model', 0x0112: 'Orientation', 0x0131: 'Software', 0x0132: 'DateTime',
    0x013b: 'Artist', 0x8298: 'Copyright', 0x8769: 'ExifIFD', 0x8825: 'GPSIFD', 0x9003: 'DateTimeOriginal', 0x9004: 'DateTimeDigitized',
    0x9010: 'OffsetTime', 0x9011: 'OffsetTimeOriginal', 0xa430: 'CameraOwnerName', 0xa431: 'BodySerialNumber', 0xa433: 'LensMake',
    0xa434: 'LensModel', 0xa435: 'LensSerialNumber', 0x927c: 'MakerNote', 0x9286: 'UserComment', 0xa420: 'ImageUniqueID',
  };
  const GPS_TAGS = { 0x0001: 'GPSLatitudeRef', 0x0002: 'GPSLatitude', 0x0003: 'GPSLongitudeRef', 0x0004: 'GPSLongitude', 0x0005: 'GPSAltitudeRef', 0x0006: 'GPSAltitude', 0x0007: 'GPSTimeStamp', 0x001d: 'GPSDateStamp', 0x0011: 'GPSImgDirection', 0x0010: 'GPSImgDirectionRef' };
  const SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

  /* Parse a TIFF structure (the body of an EXIF block). Returns { tags, gps, count } or null when it is not valid TIFF. */
  function readTiff(t) {
    if (!t || t.length < 8) return null;
    const le = t[0] === 0x49 && t[1] === 0x49;
    if (!le && !(t[0] === 0x4d && t[1] === 0x4d)) return null;
    const u16 = (o) => (o + 2 <= t.length ? (le ? t[o] | (t[o + 1] << 8) : (t[o] << 8) | t[o + 1]) : null);
    const u32 = (o) => (o + 4 <= t.length ? (le ? (t[o] | (t[o + 1] << 8) | (t[o + 2] << 16) | (t[o + 3] << 24)) >>> 0 : ((t[o] << 24) | (t[o + 1] << 16) | (t[o + 2] << 8) | t[o + 3]) >>> 0) : null);
    const s32 = (o) => { const v = u32(o); return v === null ? null : v | 0; };
    if (u16(2) !== 42) return null;
    const seen = new Set();
    let count = 0;
    function value(type, n, at) {
      const size = SIZE[type] || 1;
      const total = size * n;
      const off = total <= 4 ? at : u32(at);
      if (off === null || off + total > t.length) return undefined;
      if (type === 2) { let s = ''; for (let i = 0; i < n; i++) { const c = t[off + i]; if (c === 0) break; s += String.fromCharCode(c); } return s.trim(); }
      const out = [];
      for (let i = 0; i < n && i < 64; i++) {
        const p = off + i * size;
        if (type === 3) out.push(u16(p));
        else if (type === 4) out.push(u32(p));
        else if (type === 9) out.push(s32(p));
        else if (type === 5) { const d = u32(p + 4); out.push(d ? u32(p) / d : NaN); }
        else if (type === 10) { const d = s32(p + 4); out.push(d ? s32(p) / d : NaN); }
        else out.push(t[p]);
      }
      return n === 1 ? out[0] : out;
    }
    function ifd(off, names, into) {
      if (off === null || off < 8 || off + 2 > t.length || seen.has(off)) return null;
      seen.add(off);
      const n = u16(off);
      if (n === null || n > 1000) return null;
      for (let i = 0; i < n; i++) {
        const e = off + 2 + i * 12;
        if (e + 12 > t.length) break;
        const tag = u16(e), type = u16(e + 2), cnt = u32(e + 4);
        count++;
        const name = names[tag];
        if (!name) continue;
        if (name === 'MakerNote' || name === 'UserComment') { into[name] = true; continue; }
        into[name] = (name === 'ExifIFD' || name === 'GPSIFD') ? u32(e + 8) : value(type, cnt, e + 8);
      }
      return u32(off + 2 + n * 12);
    }
    const tags = {}, gps = {};
    const next = ifd(u32(4), TAGS, tags);
    if (tags.ExifIFD) ifd(tags.ExifIFD, TAGS, tags);
    if (tags.GPSIFD) ifd(tags.GPSIFD, GPS_TAGS, gps);
    if (next) { const thumb = {}; ifd(next, TAGS, thumb); if (Object.keys(thumb).length) tags.hasThumbnail = true; }
    delete tags.ExifIFD; delete tags.GPSIFD;
    return { tags, gps, count };
  }

  /* Decimal degrees from EXIF GPS (degrees, minutes, seconds as rationals and an N/S/E/W reference). */
  function gpsDecimal(gps) {
    const conv = (dms, ref) => {
      if (!Array.isArray(dms) || dms.length < 1 || dms.some((x) => !Number.isFinite(x))) return null;
      const [d, m = 0, s = 0] = dms;
      let v = d + m / 60 + s / 3600;
      if (ref === 'S' || ref === 'W') v = -v;
      return v;
    };
    const lat = conv(gps.GPSLatitude, gps.GPSLatitudeRef), lon = conv(gps.GPSLongitude, gps.GPSLongitudeRef);
    if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0 && !gps.GPSLatitudeRef)) return null;
    const alt = Number.isFinite(gps.GPSAltitude) ? (gps.GPSAltitudeRef === 1 ? -gps.GPSAltitude : gps.GPSAltitude) : null;
    return { lat, lon, alt };
  }

  /* Human-readable list of what the metadata reveals. */
  function summarize(exif, extras) {
    const found = [];
    if (exif) {
      const t = exif.tags, loc = gpsDecimal(exif.gps);
      if (loc) found.push({ id: 'gps', level: 'high', label: 'Location where it was taken', value: `${Math.abs(loc.lat).toFixed(5)}° ${loc.lat >= 0 ? 'N' : 'S'}, ${Math.abs(loc.lon).toFixed(5)}° ${loc.lon >= 0 ? 'E' : 'W'}`, loc });
      else if (Object.keys(exif.gps).length) found.push({ id: 'gps-partial', level: 'medium', label: 'Partial location data', value: 'GPS fields present' });
      const when = t.DateTimeOriginal || t.DateTime;
      if (when) found.push({ id: 'date', level: 'medium', label: 'Date and time taken', value: formatExifDate(when) + (t.OffsetTimeOriginal ? ` (UTC${t.OffsetTimeOriginal})` : '') });
      if (t.CameraOwnerName || t.Artist) found.push({ id: 'owner', level: 'high', label: 'Owner or author name', value: t.CameraOwnerName || t.Artist });
      if (t.BodySerialNumber || t.LensSerialNumber) found.push({ id: 'serial', level: 'high', label: 'Camera serial number', value: t.BodySerialNumber || t.LensSerialNumber });
      if (t.Make || t.Model) found.push({ id: 'camera', level: 'low', label: 'Camera or phone', value: [t.Make, t.Model].filter(Boolean).join(' ').replace(/^(\w+) \1 /i, '$1 ') });
      if (t.LensModel) found.push({ id: 'lens', level: 'low', label: 'Lens', value: t.LensModel });
      if (t.Software) found.push({ id: 'software', level: 'low', label: 'Software', value: t.Software });
      if (t.ImageDescription) found.push({ id: 'desc', level: 'medium', label: 'Description', value: t.ImageDescription });
      if (t.Copyright) found.push({ id: 'copyright', level: 'low', label: 'Copyright', value: t.Copyright });
      if (t.ImageUniqueID) found.push({ id: 'uid', level: 'medium', label: 'Unique image ID', value: t.ImageUniqueID });
      if (t.MakerNote) found.push({ id: 'makernote', level: 'medium', label: 'Maker notes', value: 'Manufacturer data, can include serial numbers' });
      if (t.hasThumbnail) found.push({ id: 'thumb', level: 'medium', label: 'Embedded thumbnail', value: 'A small copy of the photo, which may show it before any crop or edit' });
    }
    (extras || []).forEach((x) => found.push(x));
    return found;
  }

  function formatExifDate(s) {
    const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s || '');
    return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}${m[6] ? ':' + m[6] : ''}` : s;
  }

  /* ---------------- JPEG ---------------- */
  const SOI = 0xd8, EOI = 0xd9, SOS = 0xda;
  const isRST = (m) => m >= 0xd0 && m <= 0xd7;
  const standalone = (m) => isRST(m) || m === SOI || m === EOI || m === 0x01;

  /* Split a JPEG into its parts: marker segments (with payload), entropy-coded scan data, and anything after EOI. */
  function jpegParts(b) {
    if (detectType(b) !== 'jpeg') throw new Error('Not a JPEG file.');
    const parts = [];
    let i = 2, ended = false;
    while (i < b.length) {
      if (b[i] !== 0xff) throw new Error('Damaged JPEG: expected a marker at byte ' + i + '.');
      while (b[i] === 0xff && i < b.length) i++; // fill bytes
      const m = b[i]; i++;
      if (m === EOI) { ended = true; break; }
      if (standalone(m)) { parts.push({ kind: 'marker', marker: m, bytes: b.subarray(i - 2, i) }); continue; }
      if (i + 2 > b.length) throw new Error('Damaged JPEG: segment length missing.');
      const len = (b[i] << 8) | b[i + 1];
      if (len < 2 || i + len > b.length) throw new Error('Damaged JPEG: segment runs past the end of the file.');
      const seg = { kind: 'segment', marker: m, start: i - 2, bytes: b.subarray(i - 2, i + len), payload: b.subarray(i + 2, i + len) };
      parts.push(seg);
      i += len;
      if (m === SOS) {
        // entropy-coded data runs until a marker that is not a stuffed 0xFF00 or a restart marker
        const s = i;
        while (i < b.length) {
          if (b[i] === 0xff && i + 1 < b.length) {
            const n = b[i + 1];
            if (n === 0x00 || isRST(n) || n === 0xff) { i += n === 0xff ? 1 : 2; continue; }
            break;
          }
          i++;
        }
        parts.push({ kind: 'scan', bytes: b.subarray(s, i) });
      }
    }
    if (!ended) throw new Error('Damaged JPEG: the end-of-image marker is missing.');
    return { parts, trailing: b.subarray(i) };
  }

  function classify(seg) {
    const m = seg.marker, p = seg.payload;
    if (m === 0xe0) return startsWith(p, 0, 'JFIF\0') ? 'jfif' : startsWith(p, 0, 'JFXX\0') ? 'jfxx' : 'app0';
    if (m === 0xe1) return startsWith(p, 0, 'Exif\0') ? 'exif' : startsWith(p, 0, 'http://ns.adobe.com/xap/1.0/\0') ? 'xmp' : startsWith(p, 0, 'http://ns.adobe.com/xmp/extension/\0') ? 'xmp-ext' : 'app1';
    if (m === 0xe2) return startsWith(p, 0, 'ICC_PROFILE\0') ? 'icc' : startsWith(p, 0, 'MPF\0') ? 'mpf' : 'app2';
    if (m === 0xed) return 'iptc';
    if (m === 0xee) return 'adobe';
    if (m === 0xfe) return 'comment';
    if (m >= 0xe3 && m <= 0xef) return 'app';
    return 'image';
  }

  function inspectJpeg(b) {
    const { parts, trailing } = jpegParts(b);
    let exif = null;
    const kinds = new Set();
    let comment = '';
    for (const p of parts) {
      if (p.kind !== 'segment') continue;
      const k = classify(p);
      kinds.add(k);
      if (k === 'exif' && !exif) exif = readTiff(p.payload.subarray(6));
      if (k === 'comment' && !comment) comment = ascii(p.payload, 0, Math.min(p.payload.length, 200)).replace(/\0+$/, '');
    }
    const extras = [];
    if (kinds.has('xmp') || kinds.has('xmp-ext')) extras.push({ id: 'xmp', level: 'medium', label: 'XMP metadata', value: 'Editing history, ratings, sometimes location' });
    if (kinds.has('iptc')) extras.push({ id: 'iptc', level: 'medium', label: 'IPTC metadata', value: 'Captions, keywords, credits, sometimes location' });
    if (comment) extras.push({ id: 'comment', level: 'low', label: 'Comment', value: comment });
    if (trailing.length > 2) extras.push({ id: 'trailing', level: 'medium', label: 'Extra data after the image', value: `${trailing.length.toLocaleString('en-US')} bytes, often a second image such as a depth map or preview` });
    return { type: 'jpeg', exif, orientation: exif && exif.tags.Orientation ? exif.tags.Orientation : 1, found: summarize(exif, extras), kinds: [...kinds], trailingBytes: trailing.length };
  }

  /* A minimal EXIF block holding only the orientation, so a photo shot sideways still displays the right way up. */
  function orientationExif(o) {
    const body = [0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, o & 0xff, 0, 0, 0, 0, 0, 0];
    const len = body.length + 2;
    return Uint8Array.from([0xff, 0xe1, len >> 8, len & 0xff, ...body]);
  }

  function concat(chunks) {
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }

  /* Remove EXIF, XMP, IPTC, comments, maker data and trailing embedded images. Keeps the image data, quantisation
     and Huffman tables, the JFIF header, the Adobe colour-transform marker and (by default) the ICC colour profile. */
  function cleanJpeg(b, { keepOrientation = true, keepIcc = true } = {}) {
    const info = inspectJpeg(b);
    const { parts, trailing } = jpegParts(b);
    const out = [Uint8Array.from([0xff, SOI])];
    const removed = new Set();
    let insertedOrientation = false;
    const wantOrientation = keepOrientation && info.orientation >= 2 && info.orientation <= 8;
    const insertOrientation = () => { if (wantOrientation && !insertedOrientation) { out.push(orientationExif(info.orientation)); insertedOrientation = true; } };
    parts.forEach((p, idx) => {
      if (p.kind !== 'segment') { if (p.kind === 'scan' || p.kind === 'marker') out.push(p.bytes); return; }
      const k = classify(p);
      const keep = k === 'jfif' || k === 'jfxx' || k === 'adobe' || k === 'image' || (k === 'icc' && keepIcc);
      if (!keep) { removed.add(k); return; }
      out.push(p.bytes);
      if (k === 'jfif') insertOrientation();
      if (idx === 0 && k !== 'jfif') { /* no JFIF header: orientation goes first */ }
    });
    if (wantOrientation && !insertedOrientation) out.splice(1, 0, orientationExif(info.orientation));
    out.push(Uint8Array.from([0xff, EOI]));
    if (trailing.length > 2) removed.add('trailing');
    return { bytes: concat(out), removed: [...removed], orientationKept: wantOrientation, before: info };
  }

  /* ---------------- PNG ---------------- */
  const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);
  function pngChunks(b) {
    if (detectType(b) !== 'png') throw new Error('Not a PNG file.');
    const chunks = [];
    let i = 8;
    while (i + 12 <= b.length) {
      const len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
      const type = ascii(b, i + 4, 4);
      if (i + 12 + len > b.length) throw new Error('Damaged PNG: chunk runs past the end of the file.');
      chunks.push({ type, bytes: b.subarray(i, i + 12 + len), data: b.subarray(i + 8, i + 8 + len) });
      i += 12 + len;
      if (type === 'IEND') break;
    }
    if (!chunks.length || chunks[0].type !== 'IHDR' || chunks[chunks.length - 1].type !== 'IEND') throw new Error('Damaged PNG.');
    return chunks;
  }
  function inspectPng(b) {
    const chunks = pngChunks(b);
    let exif = null;
    const extras = [];
    for (const c of chunks) {
      if (c.type === 'eXIf' && !exif) exif = readTiff(startsWith(c.data, 0, 'Exif\0') ? c.data.subarray(6) : c.data);
      if (c.type === 'tEXt' || c.type === 'iTXt' || c.type === 'zTXt') {
        const nul = c.data.indexOf(0);
        const key = ascii(c.data, 0, nul > 0 ? Math.min(nul, 79) : 0);
        const val = c.type === 'tEXt' ? ascii(c.data, nul + 1, Math.min(160, c.data.length - nul - 1)) : '';
        extras.push({ id: 'text-' + key, level: /XML:com\.adobe\.xmp|Comment|Author|Description|Location|GPS/i.test(key) ? 'medium' : 'low', label: key === 'XML:com.adobe.xmp' ? 'XMP metadata' : `Text field "${key}"`, value: val || (key === 'XML:com.adobe.xmp' ? 'Editing history, sometimes location' : 'Compressed or international text') });
      }
      if (c.type === 'tIME') extras.push({ id: 'time', level: 'low', label: 'Last modified time', value: 'Stored in the file' });
    }
    return { type: 'png', exif, orientation: exif && exif.tags.Orientation ? exif.tags.Orientation : 1, found: summarize(exif, extras) };
  }
  function cleanPng(b) {
    const before = inspectPng(b);
    const chunks = pngChunks(b);
    const removed = new Set();
    const keep = chunks.filter((c) => { if (PNG_DROP.has(c.type)) { removed.add(c.type); return false; } return true; });
    return { bytes: concat([b.subarray(0, 8), ...keep.map((c) => c.bytes)]), removed: [...removed], orientationKept: false, before };
  }

  /* ---------------- WebP ---------------- */
  function webpChunks(b) {
    if (detectType(b) !== 'webp') throw new Error('Not a WebP file.');
    const chunks = [];
    let i = 12;
    const end = Math.min(b.length, 8 + (((b[4]) | (b[5] << 8) | (b[6] << 16) | (b[7] << 24)) >>> 0));
    while (i + 8 <= end) {
      const type = ascii(b, i, 4);
      const len = ((b[i + 4]) | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24)) >>> 0;
      const padded = len + (len & 1);
      if (i + 8 + len > b.length) throw new Error('Damaged WebP: chunk runs past the end of the file.');
      chunks.push({ type, bytes: b.subarray(i, Math.min(b.length, i + 8 + padded)), data: b.subarray(i + 8, i + 8 + len) });
      i += 8 + padded;
    }
    return chunks;
  }
  function inspectWebp(b) {
    const chunks = webpChunks(b);
    let exif = null;
    const extras = [];
    for (const c of chunks) {
      if (c.type === 'EXIF' && !exif) exif = readTiff(startsWith(c.data, 0, 'Exif\0') ? c.data.subarray(6) : c.data);
      if (c.type === 'XMP ') extras.push({ id: 'xmp', level: 'medium', label: 'XMP metadata', value: 'Editing history, sometimes location' });
    }
    return { type: 'webp', exif, orientation: 1, found: summarize(exif, extras) };
  }
  function cleanWebp(b) {
    const before = inspectWebp(b);
    const chunks = webpChunks(b);
    const removed = new Set();
    const kept = [];
    for (const c of chunks) {
      if (c.type === 'EXIF' || c.type === 'XMP ') { removed.add(c.type.trim()); continue; }
      if (c.type === 'VP8X') { const copy = c.bytes.slice(); copy[8] &= ~(0x08 | 0x04); kept.push(copy); continue; }
      kept.push(c.bytes);
    }
    const body = concat(kept);
    const size = body.length + 4;
    const head = Uint8Array.from([0x52, 0x49, 0x46, 0x46, size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >>> 24) & 0xff, 0x57, 0x45, 0x42, 0x50]);
    return { bytes: concat([head, body]), removed: [...removed], orientationKept: false, before };
  }

  function inspect(b) {
    const t = detectType(b);
    if (t === 'jpeg') return inspectJpeg(b);
    if (t === 'png') return inspectPng(b);
    if (t === 'webp') return inspectWebp(b);
    return { type: t, exif: null, orientation: 1, found: [], unsupported: true };
  }
  function clean(b, opts) {
    const t = detectType(b);
    if (t === 'jpeg') return cleanJpeg(b, opts);
    if (t === 'png') return cleanPng(b);
    if (t === 'webp') return cleanWebp(b);
    throw new Error('This file type cannot be cleaned without re-encoding.');
  }

  /* CRC-32 (IEEE) and a store-only ZIP writer, for "download all". */
  const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function zip(files) {
    const enc = new TextEncoder();
    const local = [], central = [];
    let offset = 0;
    const u16 = (v) => [v & 0xff, (v >> 8) & 0xff];
    const u32 = (v) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff];
    for (const f of files) {
      const name = enc.encode(f.name), crc = crc32(f.data), n = f.data.length;
      const head = Uint8Array.from([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(n), ...u32(n), ...u16(name.length), ...u16(0)]);
      local.push(head, name, f.data);
      central.push(Uint8Array.from([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(n), ...u32(n), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), name);
      offset += head.length + name.length + n;
    }
    const cd = concat(central);
    const endRec = Uint8Array.from([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cd.length), ...u32(offset), ...u16(0)]);
    return concat([...local, cd, endRec]);
  }

  return { detectType, readTiff, gpsDecimal, summarize, jpegParts, inspectJpeg, cleanJpeg, pngChunks, inspectPng, cleanPng, webpChunks, inspectWebp, cleanWebp, inspect, clean, crc32, zip, orientationExif };
});
