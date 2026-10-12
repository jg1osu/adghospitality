<?php
declare(strict_types=1);

/**
 * Portable PHP 7.4+ alternative to /api/inquiry on Vercel.
 * Upload as public_html/inquiry.php and set public/config.js inquiryEndpoint to
 * '/inquiry.php'. Put adg-inquiry-config.php OUTSIDE public_html; see the example.
 * Never publish this directory's configuration example as a live private config.
 */
const ADG_MAX_BYTES = 12288;
const ADG_MIN_FORM_TIME_MS = 2000;
const ADG_MAX_FORM_AGE_MS = 86400000;

function adg_respond(int $status, array $body): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function adg_clean($value, bool $multiline = false): string {
    if (!is_string($value)) return '';
    $value = str_replace(["\r\n", "\r"], "\n", $value);
    $value = preg_replace('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/u', '', $value);
    if ($value === null) return '';
    if (!$multiline) $value = preg_replace('/\s+/u', ' ', $value);
    return trim($value ?? '');
}

function adg_length(string $value): int {
    return preg_match_all('/./us', $value, $unused) ?: 0;
}

function adg_email($value): bool {
    return is_string($value) && strlen($value) <= 254 &&
        !preg_match('/[\r\n]/', $value) && filter_var($value, FILTER_VALIDATE_EMAIL) !== false;
}

function adg_inside(string $path, string $root): bool {
    return $root !== '' && ($path === $root || strpos($path, $root . DIRECTORY_SEPARATOR) === 0);
}

function adg_config(): array {
    $documentRoot = realpath($_SERVER['DOCUMENT_ROOT'] ?? '') ?: '';
    $path = getenv('ADG_INQUIRY_CONFIG_PATH') ?: ($documentRoot ? dirname($documentRoot) . '/adg-inquiry-config.php' : '');
    $config = [];
    if ($path && is_file($path)) {
        $resolved = realpath($path);
        if (!$resolved || !$documentRoot || adg_inside($resolved, $documentRoot)) {
            adg_respond(503, ['success' => false, 'message' => 'Online inquiries are not connected yet. Please schedule a consultation or contact ADG Hospitality directly.']);
        }
        $loaded = require $resolved;
        if (is_array($loaded)) $config = $loaded;
    }
    foreach (['to_email' => 'INQUIRY_TO_EMAIL', 'from_email' => 'INQUIRY_FROM_EMAIL', 'site_origin' => 'INQUIRY_SITE_ORIGIN', 'state_dir' => 'ADG_INQUIRY_STATE_DIR'] as $key => $variable) {
        $environment = getenv($variable);
        if ($environment !== false && $environment !== '') $config[$key] = $environment;
    }
    return $config;
}

function adg_same_origin(array $config): bool {
    if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') return false;
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (!$origin) return true; // Validation and spam checks still apply to all requests.
    $parts = parse_url($origin);
    if (!$parts || !isset($parts['scheme'], $parts['host']) || !in_array($parts['scheme'], ['http', 'https'], true)) return false;
    if (isset($parts['user']) || isset($parts['pass']) || isset($parts['path']) || isset($parts['query']) || isset($parts['fragment'])) return false;
    $scheme = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http';
    $expected = $config['site_origin'] ?? '';
    if (!$expected) $expected = $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? '');
    return is_string($expected) && hash_equals(rtrim($expected, '/'), $origin);
}

function adg_validate(array $input, int $now): array {
    $errors = [];
    if ((isset($input['website']) && !is_string($input['website'])) || (is_string($input['website'] ?? null) && trim($input['website']) !== '')) {
        return ['ok' => false, 'errors' => ['form' => 'We could not accept this submission. Please refresh the page and try again.']];
    }
    $opened = $input['submittedAt'] ?? null;
    if (is_string($opened) && preg_match('/^\d{13}$/D', $opened)) $opened = (float) $opened;
    if ((!is_int($opened) && !is_float($opened)) || !is_finite((float) $opened) || $now - $opened < ADG_MIN_FORM_TIME_MS || $now - $opened > ADG_MAX_FORM_AGE_MS) {
        $errors['form'] = 'Please wait a moment before sending. If this page has been open for a day, refresh it and try again.';
    }
    $inquiry = [];
    foreach (['name', 'partner', 'phone', 'date', 'package', 'location', 'preferredCall'] as $field) $inquiry[$field] = adg_clean($input[$field] ?? null);
    $inquiry['email'] = is_string($input['email'] ?? null) ? trim($input['email']) : '';
    $inquiry['message'] = adg_clean($input['message'] ?? null, true);
    $guests = $input['guests'] ?? null;
    if (is_string($guests) && preg_match('/^\d{1,2}$/D', $guests)) $guests = (int) $guests;
    $inquiry['guests'] = $guests;
    $inquiry['consent'] = ($input['consent'] ?? false) === true;
    if (adg_length($inquiry['name']) < 2 || adg_length($inquiry['name']) > 100) $errors['name'] = 'Please enter your name (2–100 characters).';
    if (!adg_email($inquiry['email']) || (is_string($input['email'] ?? null) && preg_match('/[\r\n]/', $input['email']))) $errors['email'] = 'Please enter a valid email address.';
    foreach (['partner' => 100, 'phone' => 40, 'location' => 200, 'preferredCall' => 200, 'message' => 4000] as $field => $limit) {
        if (adg_length($inquiry[$field]) > $limit || (isset($input[$field]) && !is_string($input[$field]))) $errors[$field] = 'Please shorten this field and try again.';
    }
    if ((!is_int($guests) && !is_float($guests)) || !is_finite((float) $guests) || floor((float) $guests) !== (float) $guests || $guests < 0 || $guests > 30) $errors['guests'] = 'Please choose a guest count from 0 to 30, excluding the couple.';
    if (!in_array($inquiry['package'], ['Petite', 'Signature', 'Premier', 'Not sure'], true)) $errors['package'] = 'Please choose a package or “Not sure.”';
    if (!$inquiry['consent']) $errors['consent'] = 'Please agree to be contacted about your inquiry.';
    if (isset($input['date']) && !is_string($input['date'])) $errors['date'] = 'Please enter a valid date, or leave it blank.';
    if ($inquiry['date'] !== '') {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $inquiry['date'], new DateTimeZone('America/New_York'));
        $today = (new DateTimeImmutable('@' . (int) floor($now / 1000)))->setTimezone(new DateTimeZone('America/New_York'))->format('Y-m-d');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/D', $inquiry['date']) || !$date || $date->format('Y-m-d') !== $inquiry['date'] || $inquiry['date'] < $today) $errors['date'] = 'Please choose today or a future date, or leave it blank.';
    }
    return $errors ? ['ok' => false, 'errors' => $errors] : ['ok' => true, 'inquiry' => $inquiry];
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    adg_respond(405, ['success' => false, 'message' => 'Please submit the inquiry form using POST.']);
}
$config = adg_config();
if (!adg_same_origin($config)) adg_respond(403, ['success' => false, 'message' => 'Please submit your inquiry from this website.']);
if (!preg_match('/^application\/json(?:\s*;|$)/i', $_SERVER['CONTENT_TYPE'] ?? '')) adg_respond(415, ['success' => false, 'message' => 'Please submit the inquiry form as JSON.']);
if (isset($_SERVER['CONTENT_LENGTH']) && (!ctype_digit($_SERVER['CONTENT_LENGTH']) || (int) $_SERVER['CONTENT_LENGTH'] > ADG_MAX_BYTES)) adg_respond(413, ['success' => false, 'message' => 'Please shorten your message and try again.']);
$stream = fopen('php://input', 'rb');
$raw = $stream ? stream_get_contents($stream, ADG_MAX_BYTES + 1) : false;
if ($stream) fclose($stream);
if (!is_string($raw) || strlen($raw) > ADG_MAX_BYTES) adg_respond(413, ['success' => false, 'message' => 'Please shorten your message and try again.']);
$decoded = json_decode($raw);
if (!($decoded instanceof stdClass) || json_last_error() !== JSON_ERROR_NONE) adg_respond(400, ['success' => false, 'message' => 'We could not read your inquiry. Please refresh the page and try again.']);
$result = adg_validate((array) $decoded, (int) floor(microtime(true) * 1000));
if (!$result['ok']) adg_respond(400, ['success' => false, 'message' => 'Please check the form and try again.', 'errors' => $result['errors']]);
$key = $_SERVER['HTTP_IDEMPOTENCY_KEY'] ?? '';
if ($key && !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iD', $key)) adg_respond(400, ['success' => false, 'message' => 'Please refresh the page and submit your inquiry again.']);
$recipient = is_string($config['to_email'] ?? null) ? trim($config['to_email']) : '';
$sender = is_string($config['from_email'] ?? null) ? trim($config['from_email']) : '';
if (!adg_email($recipient) || !adg_email($sender)) adg_respond(503, ['success' => false, 'message' => 'Online inquiries are not connected yet. Please schedule a consultation or contact ADG Hospitality directly.']);

$inquiry = $result['inquiry'];
$dedupe = null;
$fingerprint = hash('sha256', json_encode($inquiry, JSON_UNESCAPED_UNICODE));
if ($key && !empty($config['state_dir'])) {
    $stateDir = is_string($config['state_dir']) ? realpath($config['state_dir']) : false;
    $documentRoot = realpath($_SERVER['DOCUMENT_ROOT'] ?? '') ?: '';
    if (!$stateDir || !$documentRoot || adg_inside($stateDir, $documentRoot) || !is_dir($stateDir) || !is_writable($stateDir)) adg_respond(503, ['success' => false, 'message' => 'We couldn’t send your inquiry. Please try again or schedule a consultation.']);
    $file = $stateDir . DIRECTORY_SEPARATOR . 'adg-inquiry-' . hash('sha256', $key) . '.json';
    $dedupe = fopen($file, 'c+');
    if (!$dedupe || !flock($dedupe, LOCK_EX | LOCK_NB)) adg_respond(409, ['success' => false, 'message' => 'Your inquiry is already being sent. Please try again in a moment.']);
    @chmod($file, 0600);
    $previous = json_decode(stream_get_contents($dedupe), true);
    if (is_array($previous) && isset($previous['sentAt'], $previous['hash']) && time() - (int) $previous['sentAt'] < 86400) {
        if (!hash_equals($previous['hash'], $fingerprint)) adg_respond(409, ['success' => false, 'message' => 'This inquiry has changed. Please refresh the page and submit it again.']);
        adg_respond(200, ['success' => true, 'message' => 'Thank you — your inquiry has been submitted. We look forward to hearing about your celebration.']);
    }
    // Remove old deduplication records without retaining submitted personal data.
    foreach (glob($stateDir . DIRECTORY_SEPARATOR . 'adg-inquiry-*.json') ?: [] as $oldFile) {
        if (!preg_match('/^adg-inquiry-[0-9a-f]{64}\.json$/D', basename($oldFile))) continue;
        $modifiedAt = @filemtime($oldFile);
        if ($oldFile !== $file && is_file($oldFile) && $modifiedAt !== false && $modifiedAt < time() - 172800) @unlink($oldFile);
    }
}

$text = implode("\n", [
    'New Charleston elopement inquiry for ADG Hospitality', '',
    'Name: ' . $inquiry['name'], 'Partner: ' . ($inquiry['partner'] ?: 'Not provided'),
    'Email: ' . $inquiry['email'], 'Phone: ' . ($inquiry['phone'] ?: 'Not provided'),
    'Preferred date: ' . ($inquiry['date'] ?: 'Flexible / not provided'),
    'Guests (excluding the couple): ' . $inquiry['guests'], 'Package: ' . $inquiry['package'],
    'Location preference: ' . ($inquiry['location'] ?: 'Open to guidance'),
    'Preferred consultation times: ' . ($inquiry['preferredCall'] ?: 'Not provided'), '',
    'Their vision:', $inquiry['message'] ?: 'No additional details provided.', '',
    'The sender agreed to be contacted about this inquiry. No marketing consent was requested.',
]);
$subject = 'Charleston elopement inquiry - ' . $inquiry['package'];
$headers = implode("\r\n", [
    'From: ADG Hospitality <' . $sender . '>', 'Reply-To: ' . $inquiry['email'],
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8',
]);
// A true return means the host mail service accepted the message, not inbox delivery.
try {
    $accepted = function_exists('mail') && @mail($recipient, $subject, $text, $headers);
} catch (Throwable $error) {
    $accepted = false; // Do not expose errors or the submitted personal details.
}
if ($accepted && $dedupe) {
    rewind($dedupe);
    ftruncate($dedupe, 0);
    fwrite($dedupe, json_encode(['sentAt' => time(), 'hash' => $fingerprint]));
    fflush($dedupe);
}
if ($dedupe) { flock($dedupe, LOCK_UN); fclose($dedupe); }
if (!$accepted) adg_respond(502, ['success' => false, 'message' => 'We couldn’t send your inquiry. Please try again or schedule a consultation.']);
adg_respond(200, ['success' => true, 'message' => 'Thank you — your inquiry has been submitted. We look forward to hearing about your celebration.']);
