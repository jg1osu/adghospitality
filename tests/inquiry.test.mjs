import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createInquiryHandler, validateInquiry, MAX_BODY_BYTES, MIN_FORM_TIME_MS } from '../api/inquiry.mjs';

const NOW = Date.parse('2030-05-20T16:00:00Z');
const KEY = '31c690e0-0813-4dbd-aead-2ad434125a8c';
const configuration = {
  RESEND_API_KEY: 'test-key-never-used-on-a-network',
  INQUIRY_TO_EMAIL: 'owner@example.com',
  INQUIRY_FROM_EMAIL: 'website@example.com',
};
const valid = (overrides = {}) => ({
  name: 'Alex Smith', partner: 'Taylor', email: 'alex@example.com', phone: '',
  date: '2030-06-15', guests: 20, package: 'Signature', location: 'A garden',
  message: 'A relaxed celebration with family.', preferredCall: 'Weekday mornings',
  consent: true, website: '', submittedAt: NOW - 10000, ...overrides,
});

function request(body = valid(), headers = {}) {
  return {
    method: 'POST', body,
    headers: { 'content-type': 'application/json', host: 'example.com', origin: 'https://example.com', 'idempotency-key': KEY, ...headers },
  };
}

async function invoke(req, options = {}) {
  let calls = 0;
  const handler = createInquiryHandler({
    env: configuration, now: () => NOW, makeUUID: () => KEY,
    fetchImpl: async () => { calls++; return { ok: true, json: async () => ({ id: 'test-receipt' }) }; },
    ...options,
  });
  const res = {
    headers: {}, statusCode: null, body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body; },
  };
  await handler(req, res);
  return { status: res.statusCode, body: JSON.parse(res.body), headers: res.headers, calls };
}

test('accepts the package choices and valid boundaries without requiring optional details', () => {
  for (const chosen of ['Petite', 'Signature', 'Premier', 'Not sure']) {
    for (const guests of [0, 30, '20']) {
      const result = validateInquiry(valid({ package: chosen, guests, date: '', phone: undefined, preferredCall: undefined }), NOW);
      assert.equal(result.ok, true);
      assert.equal(typeof result.inquiry.guests, 'number');
    }
  }
});

test('rejects oversize groups, ambiguous values, missing consent, and invented packages', () => {
  for (const guests of [31, -1, 1.5, '', null, true, '20 guests', {}]) {
    assert.ok(validateInquiry(valid({ guests }), NOW).errors.guests);
  }
  for (const consent of [false, 'true', 1, undefined]) {
    assert.ok(validateInquiry(valid({ consent }), NOW).errors.consent);
  }
  assert.ok(validateInquiry(valid({ package: 'Budget' }), NOW).errors.package);
  assert.ok(validateInquiry(valid({ name: 'A' }), NOW).errors.name);
});

test('checks form age and honeypot without treating them as a rate limiter', () => {
  assert.equal(validateInquiry(valid({ submittedAt: NOW - MIN_FORM_TIME_MS }), NOW).ok, true);
  assert.equal(validateInquiry(valid({ submittedAt: String(NOW - 10000) }), NOW).ok, true);
  for (const submittedAt of [NOW, NOW + 100000, NOW - 86400001, undefined, 'bad']) {
    assert.ok(validateInquiry(valid({ submittedAt }), NOW).errors.form);
  }
  assert.ok(validateInquiry(valid({ website: 'spam.example' }), NOW).errors.form);
  assert.ok(validateInquiry(valid({ website: true }), NOW).errors.form);
});

test('uses Charleston dates, rejects impossible/past dates, and accepts a flexible date', () => {
  const beforeMidnightLocal = Date.parse('2030-05-21T02:00:00Z');
  assert.equal(validateInquiry(valid({ date: '2030-05-20', submittedAt: beforeMidnightLocal - 10000 }), beforeMidnightLocal).ok, true);
  for (const date of ['2030-05-19', '2030-02-30', '2030-2-3', 'not a date', 123]) {
    assert.ok(validateInquiry(valid({ date }), NOW).errors.date);
  }
  assert.equal(validateInquiry(valid({ date: '' }), NOW).ok, true);
});

test('cleans display text, preserves a multiline message, rejects email header injection and oversized details', () => {
  const result = validateInquiry(valid({ name: '  Alex\u0000 \n Smith ', message: ' First line\r\nSecond line ' }), NOW);
  assert.equal(result.inquiry.name, 'Alex Smith');
  assert.equal(result.inquiry.message, 'First line\nSecond line');
  for (const email of ['alex@example.com\r\nBcc: intruder@example.com', ['alex@example.com'], 'invalid', '.alex@example.com', 'alex..smith@example.com', `alex@${'a'.repeat(64)}.com`]) {
    assert.ok(validateInquiry(valid({ email }), NOW).errors.email);
  }
  assert.ok(validateInquiry(valid({ message: 'a'.repeat(4001) }), NOW).errors.message);
  assert.ok(validateInquiry(valid({ preferredCall: 'a'.repeat(201) }), NOW).errors.preferredCall);
  assert.ok(validateInquiry(valid({ phone: {} }), NOW).errors.phone);
  assert.equal(validateInquiry([], NOW).ok, false);
});

test('success sends a plain text inquiry to the configured owner with safe reply-to and retry key', async () => {
  let sent;
  const result = await invoke(request(), {
    fetchImpl: async (url, options) => {
      sent = { url, options, email: JSON.parse(options.body) };
      return { ok: true, json: async () => ({ id: 'test-only-receipt' }) };
    },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(sent.url, 'https://api.resend.com/emails');
  assert.equal(sent.options.headers['Idempotency-Key'], `adg-inquiry-${KEY}`);
  assert.deepEqual(sent.email.to, ['owner@example.com']);
  assert.equal(sent.email.from, 'ADG Hospitality <website@example.com>');
  assert.equal(sent.email.reply_to, 'alex@example.com');
  assert.match(sent.email.text, /Preferred consultation times: Weekday mornings/);
  assert.equal(sent.email.html, undefined);
  assert.equal(result.headers['cache-control'], 'no-store');
});

test('reports missing configuration honestly and never calls a mail provider', async () => {
  for (const env of [{}, { ...configuration, RESEND_API_KEY: '' }, { ...configuration, INQUIRY_FROM_EMAIL: 'bad\r\nBcc: other@example.com' }]) {
    const result = await invoke(request(), { env });
    assert.equal(result.status, 503);
    assert.equal(result.body.success, false);
    assert.match(result.body.message, /not connected/);
    assert.equal(result.calls, 0);
  }
});

test('provider rejection, malformed receipts and network failures never become success or disclose provider details', async () => {
  for (const fetchImpl of [
    async () => ({ ok: false, json: async () => ({ message: 'private provider message' }) }),
    async () => ({ ok: true, json: async () => ({}) }),
    async () => { throw new Error('private provider credential information'); },
  ]) {
    const result = await invoke(request(), { fetchImpl });
    assert.equal(result.status, 502);
    assert.equal(result.body.success, false);
    assert.doesNotMatch(JSON.stringify(result.body), /private|credential/);
  }
});

test('enforces method, media type and same-origin browser requests before delivery', async () => {
  const badRequests = [
    [{ ...request(), method: 'GET' }, 405],
    [request(valid(), { 'content-type': 'text/plain' }), 415],
    [request(valid(), { origin: 'https://intruder.example' }), 403],
    [request(valid(), { origin: 'null' }), 403],
    [request(valid(), { origin: 'https://example.com/path' }), 403],
    [request(valid(), { 'sec-fetch-site': 'cross-site' }), 403],
  ];
  for (const [req, status] of badRequests) {
    const result = await invoke(req);
    assert.equal(result.status, status);
    assert.equal(result.calls, 0);
  }
  assert.equal((await invoke(request(valid(), { origin: '' }))).status, 200);
  assert.equal((await invoke(request(), { env: { ...configuration, INQUIRY_SITE_ORIGIN: 'https://another.example' } })).status, 403);
});

test('rejects malformed JSON, oversized UTF-8 bytes and invalid retry keys', async () => {
  for (const [req, status] of [
    [request('{bad json'), 400],
    [request(valid(), { 'content-length': String(MAX_BODY_BYTES + 1) }), 413],
    [request(valid({ message: '🌸'.repeat(3500) })), 413],
    [request(valid(), { 'idempotency-key': 'invalid' }), 400],
    [request(valid({ consent: false })), 400],
  ]) {
    const result = await invoke(req);
    assert.equal(result.status, status);
    assert.equal(result.calls, 0);
  }
});

test('reads chunked request streams and enforces the byte limit while reading', async () => {
  const req = Readable.from([JSON.stringify(valid())]);
  Object.assign(req, { method: 'POST', headers: request().headers });
  assert.equal((await invoke(req)).status, 200);
  const large = Readable.from([Buffer.alloc(MAX_BODY_BYTES), Buffer.from('x')]);
  Object.assign(large, { method: 'POST', headers: request().headers });
  assert.equal((await invoke(large)).status, 413);
});

test('supplies a UUID to the provider if a client did not supply a retry key', async () => {
  let supplied;
  const result = await invoke(request(valid(), { 'idempotency-key': '' }), {
    fetchImpl: async (url, options) => {
      supplied = options.headers['Idempotency-Key'];
      return { ok: true, json: async () => ({ id: 'test-receipt' }) };
    },
  });
  assert.equal(result.status, 200);
  assert.equal(supplied, `adg-inquiry-${KEY}`);
});
