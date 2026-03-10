const SENSITIVE_KEYS = new Set([
  'authorization',
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'jwt',
  'apikey',
  'key',
  'keyhash',
  'webhooksecret',
  'webhooksecretencrypted',
  'webhooksecrethash',
  'secret',
]);

function normalizeKeyName(keyName: string) {
  return keyName.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function redactString(value: string) {
  if (value.startsWith('Bearer ')) {
    return 'Bearer [REDACTED]';
  }

  if (value.startsWith('qk_')) {
    return `${value.slice(0, 12)}...[REDACTED]`;
  }

  if (value.startsWith('qwhsec_')) {
    return `${value.slice(0, 8)}...[REDACTED]`;
  }

  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
    return '[REDACTED_JWT]';
  }

  return '[REDACTED]';
}

export function sanitizeForLogs(value: unknown, keyName?: string): unknown {
  if (keyName && SENSITIVE_KEYS.has(normalizeKeyName(keyName))) {
    return typeof value === 'string' ? redactString(value) : '[REDACTED]';
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLogs(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        sanitizeForLogs(entryValue, key),
      ]),
    );
  }

  if (typeof value === 'string') {
    return value;
  }

  return value;
}
