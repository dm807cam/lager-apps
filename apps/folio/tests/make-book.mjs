// Builds small invented books for the Folio tests: an EPUB 3 with a cover, contents, styles, a picture and a footnote.
import JSZip from "jszip";
import { deflateSync } from "node:zlib";

const WORDS = "the lantern river morning quiet garden window letter harbour orchard silver mountain paper story evening winter meadow candle voice bridge stone small slow bright distant patient curious gentle".split(" ");
function sentence(seed) {
  let x = seed * 9301 + 49297; const n = 9 + (seed % 9), out = [];
  for (let i = 0; i < n; i++) { x = (x * 233 + 17) % 100003; out.push(WORDS[x % WORDS.length]); }
  const s = out.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}
export function paragraphs(count, start = 0) {
  return Array.from({ length: count }, (_, i) => Array.from({ length: 4 }, (_, k) => sentence(start + i * 4 + k)).join(" "));
}

/* a one-colour PNG, enough to stand in for a cover or an illustration */
function png(w, h, rgb) {
  const crc = (buf) => { let c, crcTable = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
    let v = 0xffffffff; for (const b of buf) v = crcTable[(v ^ b) & 0xff] ^ (v >>> 8); return (v ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.alloc(1 + w * 3); for (let x = 0; x < w; x++) { row[1 + x * 3] = rgb[0]; row[2 + x * 3] = rgb[1]; row[3 + x * 3] = rgb[2]; }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const xhtml = (title, body) => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en"><head><title>${title}</title><link rel="stylesheet" href="../styles/book.css"/></head><body>${body}</body></html>`;

export async function makeEpub({ title = "The Lantern Orchard", author = "Mira Testwood", chapters = 3, perChapter = 40, drm = false, epub2 = false } = {}) {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  if (drm) zip.file("META-INF/encryption.xml", `<?xml version="1.0"?><encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#"><enc:EncryptedData><enc:EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes128-cbc"/><enc:CipherData><enc:CipherReference URI="OEBPS/text/ch1.xhtml"/></enc:CipherData></enc:EncryptedData></encryption>`);
  zip.file("OEBPS/styles/book.css", `.emph{font-style:italic}.centre{text-align:center}.hidden{display:none}p{text-indent:1em}`);
  zip.file("OEBPS/images/cover.png", png(60, 90, [120, 60, 140]));
  zip.file("OEBPS/images/map.png", png(80, 50, [40, 120, 90]));
  zip.file("OEBPS/text/cover.xhtml", xhtml("Cover", `<div><img src="../images/cover.png" alt="Cover"/></div>`));
  const items = [], spine = [`<itemref idref="cover"/>`], nav = [];
  for (let c = 1; c <= chapters; c++) {
    const ps = paragraphs(perChapter, c * 1000);
    let body = `<h1 id="c${c}">Chapter ${c}</h1>` + ps.map((p, i) => i === 2 && c === 1 ? `<p>${p} <span class="emph">An italic aside.</span><a epub:type="noteref" href="notes.xhtml#n1"><sup>1</sup></a></p>` : `<p>${p}</p>`).join("");
    if (c === 1) body += `<p class="centre">* * *</p><p class="hidden">Text no reader should see.</p><img src="../images/map.png" alt="A small map"/><h2 id="c1b">A second part</h2>` + paragraphs(10, 7000).map(p => `<p>${p}</p>`).join("");
    zip.file(`OEBPS/text/ch${c}.xhtml`, xhtml("Chapter " + c, body));
    items.push(`<item id="ch${c}" href="text/ch${c}.xhtml" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="ch${c}"/>`);
    nav.push(`<li><a href="text/ch${c}.xhtml">Chapter ${c}</a>${c === 1 ? `<ol><li><a href="text/ch1.xhtml#c1b">A second part</a></li></ol>` : ""}</li>`);
  }
  zip.file("OEBPS/text/notes.xhtml", xhtml("Notes", `<h1>Notes</h1><aside epub:type="footnote" id="n1"><p>The orchard was planted in an invented year.</p></aside>`));
  items.push(`<item id="notes" href="text/notes.xhtml" media-type="application/xhtml+xml"/>`); spine.push(`<itemref idref="notes"/>`);
  nav.push(`<li><a href="text/notes.xhtml">Notes</a></li>`);
  if (epub2) {
    const pts = []; let n = 0;
    for (let c = 1; c <= chapters; c++) pts.push(`<navPoint id="p${++n}" playOrder="${n}"><navLabel><text>Chapter ${c}</text></navLabel><content src="text/ch${c}.xhtml"/>${c === 1 ? `<navPoint id="p${++n}" playOrder="${n}"><navLabel><text>A second part</text></navLabel><content src="text/ch1.xhtml#c1b"/></navPoint>` : ""}</navPoint>`);
    zip.file("OEBPS/toc.ncx", `<?xml version="1.0" encoding="utf-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head/><docTitle><text>${title}</text></docTitle><navMap>${pts.join("")}</navMap></ncx>`);
  }
  zip.file("OEBPS/nav.xhtml", `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol>${nav.join("")}</ol></nav></body></html>`);
  zip.file("OEBPS/content.opf", `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="${epub2 ? "2.0" : "3.0"}" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="uid">urn:uuid:test-${title.replace(/\W+/g, "-")}</dc:identifier><dc:title>${title}</dc:title><dc:creator>${author}</dc:creator><dc:language>en</dc:language>
<dc:description>&lt;p&gt;An invented book for tests.&lt;/p&gt;</dc:description></metadata>
<manifest>${epub2 ? `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>` : `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`}<item id="css" href="styles/book.css" media-type="text/css"/>
<item id="cover-img" href="images/cover.png" media-type="image/png" properties="cover-image"/><item id="map" href="images/map.png" media-type="image/png"/>
<item id="cover" href="text/cover.xhtml" media-type="application/xhtml+xml"/>${items.join("")}</manifest>
<spine${epub2 ? ' toc="ncx"' : ""}>${spine.join("")}</spine></package>`);
  return zip.generateAsync({ type: "nodebuffer", mimeType: "application/epub+zip" });
}
