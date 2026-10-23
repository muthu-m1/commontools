/* QR code payloads. Pure functions (window.QRLogic / require). The QR symbol itself is drawn by the
   qrcode-generator library; this file builds the text that goes into it, in the formats phone cameras understand. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QRLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Wi-Fi network: WIFI:T:<WPA|WEP|nopass>;S:<ssid>;P:<password>;H:true;;
     Special characters \ ; , : " in the name and password are escaped with a backslash (ZXing convention). */
  const wifiEscape = (s) => String(s).replace(/([\\;,:"])/g, '\\$1');
  function wifi({ ssid, password = '', security = 'WPA', hidden = false }) {
    if (!ssid) throw new Error('Enter the network name.');
    const T = security === 'nopass' ? 'nopass' : security === 'WEP' ? 'WEP' : 'WPA';
    if (T !== 'nopass' && !password) throw new Error('Enter the Wi-Fi password, or choose "No password".');
    let s = `WIFI:T:${T};S:${wifiEscape(ssid)};`;
    if (T !== 'nopass') s += `P:${wifiEscape(password)};`;
    if (hidden) s += 'H:true;';
    return s + ';';
  }

  /* Contact card: vCard 3.0 (RFC 2426) with CRLF line endings; commas, semicolons and backslashes in values are
     escaped, and line breaks become \n. */
  const vEscape = (s) => String(s).replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r\n|\r|\n/g, '\\n');
  function vcard({ first = '', last = '', org = '', title = '', phone = '', email = '', url = '', address = '', note = '' }) {
    if (!first && !last && !org) throw new Error('Enter a name or an organisation.');
    const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${vEscape(last)};${vEscape(first)};;;`, `FN:${vEscape([first, last].filter(Boolean).join(' ') || org)}`];
    if (org) lines.push(`ORG:${vEscape(org)}`);
    if (title) lines.push(`TITLE:${vEscape(title)}`);
    if (phone) lines.push(`TEL;TYPE=CELL:${phone.replace(/[^\d+#*]/g, '')}`);
    if (email) lines.push(`EMAIL:${vEscape(email.trim())}`);
    if (url) lines.push(`URL:${vEscape(normalizeUrl(url))}`);
    if (address) lines.push(`ADR;TYPE=HOME:;;${vEscape(address)};;;;`);
    if (note) lines.push(`NOTE:${vEscape(note)}`);
    lines.push('END:VCARD');
    return lines.join('\r\n');
  }

  /* mailto: with RFC 6068 percent-encoding of the subject and body. */
  function email({ to, subject = '', body = '' }) {
    const addr = String(to || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) throw new Error('Enter an email address like name@example.com.');
    const q = [];
    if (subject) q.push('subject=' + encodeURIComponent(subject));
    if (body) q.push('body=' + encodeURIComponent(body.replace(/\r?\n/g, '\r\n')));
    return 'mailto:' + addr + (q.length ? '?' + q.join('&') : '');
  }

  const cleanPhone = (p) => String(p || '').replace(/[^\d+]/g, '');
  /* Text message: SMSTO:<number>:<message>, the format read by both iPhone and Android camera apps. */
  function sms({ number, message = '' }) {
    const n = cleanPhone(number);
    if (n.replace('+', '').length < 3) throw new Error('Enter a phone number.');
    return `SMSTO:${n}:${message}`;
  }
  function phone({ number }) {
    const n = cleanPhone(number);
    if (n.replace('+', '').length < 3) throw new Error('Enter a phone number.');
    return 'tel:' + n;
  }

  /* Adds https:// when someone types a bare domain like example.com/page. */
  function normalizeUrl(u) {
    const s = String(u || '').trim();
    if (!s) return s;
    if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
    if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(s)) return 'https://' + s;
    return s;
  }
  function link({ url }) {
    const s = normalizeUrl(url);
    if (!s) throw new Error('Enter a web address.');
    return s;
  }
  function text({ text: t }) {
    if (!t) throw new Error('Enter some text.');
    return t;
  }

  /* UTF-8 byte length, which decides how big the code has to be in byte mode. */
  function byteLength(s) { return new TextEncoder().encode(s).length; }

  /* Byte-mode capacity of the largest QR code (version 40) per error-correction level. */
  const MAX_BYTES = { L: 2953, M: 2331, Q: 1663, H: 1273 };

  return { wifi, wifiEscape, vcard, vEscape, email, sms, phone, link, text, normalizeUrl, byteLength, MAX_BYTES };
});
