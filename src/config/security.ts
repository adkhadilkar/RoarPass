// Merged config: foundation's baseHeaders + NFR branch's CSP/privacy controls.
export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.roarpass.app",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
};

// Env references only — never inline secrets.
export const SECURITY_ENV = {
  sessionSecret: 'SESSION_SECRET',
  encryptionKey: 'DATA_ENCRYPTION_KEY',
} as const;

export const PRIVACY = {
  // GDPR/CCPA: data subject request handling window (days)
  dsrResponseWindowDays: 30,
  // Geolocation (Local Helper matching) requires explicit opt-in consent.
  geolocationRequiresConsent: true,
  retention: {
    fanProfileInactiveDays: 730,
    auditLogDays: 365,
  },
} as const;