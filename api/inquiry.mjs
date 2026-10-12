import { randomUUID } from 'node:crypto';

export const MAX_BODY_BYTES = 12 * 1024;
export const MIN_FORM_TIME_MS = 2000;
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
const PACKAGES = new Set(['Petite', 'Signature', 'Premier', 'Not sure']);
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value, multiline = false) {
  if (typeof value !== 'string') return '';
  const cleaned = value.normalize('NFC').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  return multiline ? cleaned.trim() : cleaned.replace(/\s+/g, ' ').trim();
}

function validEmail(value) {
  if (typeof value !== 'string' || value.length > 254 || /[\r\n]/.test(value) || !EMAIL.test(value)) return false;
  const [local, domain] = value.split('@');
  return local.length <= 64 && !/^\.|\.$|\.\./.test(local) && domain.split('.').every(label => label.length <= 63);
}

function charLength(value) {
  return Array.from(value).length;
}

function todayInCharleston(now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(now));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Pure validation shared by handler tests. submittedAt is the form-open timestamp. */
export function validateInquiry(input, now = Date.now()) {
  const errors = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: { form: 'Please complete the inquiry form.' } };
  }
  if ((typeof input.website === 'string' && input.website.trim()) || (input.website != null && typeof input.website !== 'string')) {
    return { ok: false, errors: { form: 'We could not accept this submission. Please refresh the page and try again.' } };
  }
  const opened = typeof input.submittedAt === 'number'
    ? input.submittedAt
    : typeof input.submittedAt === 'string' && /^\d{13}$/.test(input.submittedAt) ? Number(input.submittedAt) : NaN;
  if (!Number.isFinite(opened) || now - opened < MIN_FORM_TIME_MS || now - opened > MAX_FORM_AGE_MS) {
    errors.form = 'Please wait a moment before sending. If this page has been open for a day, refresh it and try again.';
  }
  const inquiry = {
    name: cleanText(input.name),
    partner: cleanText(input.partner),
    email: typeof input.email === 'string' ? input.email.trim() : '',
    phone: cleanText(input.phone),
    date: cleanText(input.date),
    guests: typeof input.guests === 'number' ? input.guests : typeof input.guests === 'string' && /^\d{1,2}$/.test(input.guests) ? Number(input.guests) : NaN,
    package: cleanText(input.package),
    location: cleanText(input.location),
    preferredCall: cleanText(input.preferredCall),
    message: cleanText(input.message, true),
    consent: input.consent === true,
  };
  if (charLength(inquiry.name) < 2 || charLength(inquiry.name) > 100) errors.name = 'Please enter your name (2–100 characters).';
  if (charLength(inquiry.partner) > 100 || (input.partner != null && typeof input.partner !== 'string')) errors.partner = 'Please keep your partner’s name under 100 characters.';
  if (!validEmail(inquiry.email) || /[\r\n]/.test(String(input.email ?? ''))) errors.email = 'Please enter a valid email address.';
  if (charLength(inquiry.phone) > 40 || (input.phone != null && typeof input.phone !== 'string')) errors.phone = 'Please enter a phone number under 40 characters.';
  if (!Number.isInteger(inquiry.guests) || inquiry.guests < 0 || inquiry.guests > 30) errors.guests = 'Please choose a guest count from 0 to 30, excluding the couple.';
  if (!PACKAGES.has(inquiry.package)) errors.package = 'Please choose a package or “Not sure.”';
  if (charLength(inquiry.location) > 200 || (input.location != null && typeof input.location !== 'string')) errors.location = 'Please keep your location preference under 200 characters.';
  if (charLength(inquiry.preferredCall) > 200 || (input.preferredCall != null && typeof input.preferredCall !== 'string')) errors.preferredCall = 'Please keep your preferred call times under 200 characters.';
  if (charLength(inquiry.message) > 4000 || (input.message != null && typeof input.message !== 'string')) errors.message = 'Please keep your message under 4,000 characters.';
  if (!inquiry.consent) errors.consent = 'Please agree to be contacted about your inquiry.';
  if (input.date != null && typeof input.date !== 'string') errors.date = 'Please enter a valid date, or leave it blank.';
  if (inquiry.date) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(inquiry.date) ? new Date(`${inquiry.date}T00:00:00Z`) : null;
    if (!date || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== inquiry.date || inquiry.date < todayInCharleston(now)) {
      errors.date = 'Please choose today or a future date, or leave it blank.';
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, inquiry };
}

function requestHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()];
  return typeof value === 'string' ? value : '';
}

function sameOrigin(req, env) {
  if (requestHeader(req, 'sec-fetch-site') === 'cross-site') return false;
  const origin = requestHeader(req, 'origin');
  if (!origin) return true; // Non-browser requests still undergo validation and spam checks.
  try {
    const originURL = new URL(origin);
    if (originURL.origin !== origin || !['http:', 'https:'].includes(originURL.protocol)) return false;
    const protocol = requestHeader(req, 'x-forwarded-proto') === 'http' ? 'http' : 'https';
    const expected = env.INQUIRY_SITE_ORIGIN || `${protocol}://${requestHeader(req, 'host')}`;
    const expectedURL = new URL(expected);
    return expectedURL.origin === originURL.origin && ['http:', 'https:'].includes(expectedURL.protocol);
  } catch {
    return false;
  }
}

async function readBody(req) {
  const length = requestHeader(req, 'content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) throw Object.assign(new Error('Body too large'), { status: 413 });
  if (req.body != null) {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) throw Object.assign(new Error('Body too large'), { status: 413 });
    return JSON.parse(raw);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Body too large'), { status: 413 });
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function inquiryText(inquiry) {
  return [
    'New Charleston elopement inquiry for ADG Hospitality', '',
    `Name: ${inquiry.name}`, `Partner: ${inquiry.partner || 'Not provided'}`,
    `Email: ${inquiry.email}`, `Phone: ${inquiry.phone || 'Not provided'}`,
    `Preferred date: ${inquiry.date || 'Flexible / not provided'}`,
    `Guests (excluding the couple): ${inquiry.guests}`, `Package: ${inquiry.package}`,
    `Location preference: ${inquiry.location || 'Open to guidance'}`, '',
    `Preferred consultation times: ${inquiry.preferredCall || 'Not provided'}`, '',
    'Their vision:', inquiry.message || 'No additional details provided.', '',
    'The sender agreed to be contacted about this inquiry. No marketing consent was requested.',
  ].join('\n');
}

function respond(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

/** Dependencies are injectable so tests never send real mail or need credentials. */
export function createInquiryHandler({ env = process.env, fetchImpl = globalThis.fetch, now = Date.now, makeUUID = randomUUID } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return respond(res, 405, { success: false, message: 'Please submit the inquiry form using POST.' });
    }
    if (!sameOrigin(req, env)) return respond(res, 403, { success: false, message: 'Please submit your inquiry from this website.' });
    if (!/^application\/json(?:\s*;|$)/i.test(requestHeader(req, 'content-type'))) {
      return respond(res, 415, { success: false, message: 'Please submit the inquiry form as JSON.' });
    }
    let input;
    try {
      input = await readBody(req);
    } catch (error) {
      return respond(res, error.status === 413 ? 413 : 400, { success: false, message: error.status === 413 ? 'Please shorten your message and try again.' : 'We could not read your inquiry. Please refresh the page and try again.' });
    }
    const result = validateInquiry(input, now());
    if (!result.ok) return respond(res, 400, { success: false, message: 'Please check the form and try again.', errors: result.errors });
    const key = requestHeader(req, 'idempotency-key');
    if (key && !UUID.test(key)) return respond(res, 400, { success: false, message: 'Please refresh the page and submit your inquiry again.' });
    const sender = env.INQUIRY_FROM_EMAIL?.trim();
    const recipient = env.INQUIRY_TO_EMAIL?.trim();
    if (!env.RESEND_API_KEY?.trim() || !validEmail(sender) || !validEmail(recipient)) {
      return respond(res, 503, { success: false, message: 'Online inquiries are not connected yet. Please schedule a consultation or contact ADG Hospitality directly.' });
    }
    try {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `adg-inquiry-${key || makeUUID()}`,
        },
        body: JSON.stringify({
          from: `ADG Hospitality <${sender}>`, to: [recipient], reply_to: result.inquiry.email,
          subject: `Charleston elopement inquiry — ${result.inquiry.package}`,
          text: inquiryText(result.inquiry),
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Delivery provider rejected the request');
      const receipt = await response.json();
      if (!receipt || typeof receipt.id !== 'string' || !receipt.id) throw new Error('Delivery provider returned no receipt');
      return respond(res, 200, { success: true, message: 'Thank you — your inquiry has been sent. We look forward to hearing about your celebration.' });
    } catch {
      // Never log submitted personal details or expose provider responses / credentials.
      return respond(res, 502, { success: false, message: 'We couldn’t send your inquiry. Please try again or schedule a consultation.' });
    }
  };
}

export default createInquiryHandler();
