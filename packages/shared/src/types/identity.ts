import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const UserRoleSchema = z.enum([
  'FAN',
  'LOCAL_HELPER',
  'BUSINESS_PARTNER',
  'MODERATOR',
  'ADMIN',
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const AuthProviderSchema = z.enum([
  'EMAIL',
  'PHONE',
  'GOOGLE',
  'APPLE',
  'FACEBOOK',
]);
export type AuthProvider = z.infer<typeof AuthProviderSchema>;

export const VerificationTierSchema = z.enum([
  'UNVERIFIED',
  'EMAIL_VERIFIED',
  'PHONE_VERIFIED',
  'ID_VERIFIED',
  'TRUSTED',
]);
export type VerificationTier = z.infer<typeof VerificationTierSchema>;

export const TravelStyleSchema = z.enum([
  'BUDGET',
  'COMFORT',
  'LUXURY',
  'ADVENTURE',
  'FAMILY',
]);
export type TravelStyle = z.infer<typeof TravelStyleSchema>;

export const OnboardingStepSchema = z.enum([
  'ACCOUNT_CREATED',
  'PROFILE_BASICS',
  'PREFERENCES',
  'EVENT_ACTIVATION',
  'ROLES',
  'COMPLETED',
]);
export type OnboardingStep = z.infer<typeof OnboardingStepSchema>;

// ─── Core Profile ────────────────────────────────────────────────────────────

export const FanProfileSchema = z.object({
  user_id: z.string().uuid(),
  display_name: z.string().min(2).max(60),
  avatar_url: z.string().url().nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  nationality: z.string().length(2), // ISO 3166-1 alpha-2
  preferred_language: z.string().min(2).max(5), // ISO 639-1 or BCP-47
  languages_spoken: z.array(z.string().min(2).max(5)),
  travel_style: TravelStyleSchema.nullable().optional(),
  dietary_preferences: z.array(z.string()).default([]),
  accessibility_needs: z.array(z.string()).default([]),
  roles: z.array(UserRoleSchema).min(1),
  verification_tier: VerificationTierSchema.default('UNVERIFIED'),
  onboarding_step: OnboardingStepSchema.default('ACCOUNT_CREATED'),
  activated_event_ids: z.array(z.string().uuid()).default([]),
  is_active: z.boolean().default(true),
  gdpr_consented_at: z.string().datetime().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type FanProfile = z.infer<typeof FanProfileSchema>;

// Public-safe view (no PII)
export const PublicFanProfileSchema = FanProfileSchema.pick({
  user_id: true,
  display_name: true,
  avatar_url: true,
  bio: true,
  nationality: true,
  languages_spoken: true,
  travel_style: true,
  roles: true,
  verification_tier: true,
});
export type PublicFanProfile = z.infer<typeof PublicFanProfileSchema>;

// ─── Auth ────────────────────────────────────────────────────────────────────

export const AuthCredentialSchema = z.object({
  credential_id: z.string().uuid(),
  user_id: z.string().uuid(),
  provider: AuthProviderSchema,
  provider_subject: z.string(), // email, phone E.164, or OAuth sub
  is_primary: z.boolean(),
  verified_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});
export type AuthCredential = z.infer<typeof AuthCredentialSchema>;

// ─── Event Activation ────────────────────────────────────────────────────────

export const EventActivationSchema = z.object({
  activation_id: z.string().uuid(),
  user_id: z.string().uuid(),
  event_id: z.string().uuid(),
  activated_at: z.string().datetime(),
  roles_for_event: z.array(UserRoleSchema).min(1),
  host_city_ids: z.array(z.string().uuid()).default([]),
});
export type EventActivation = z.infer<typeof EventActivationSchema>;

// ─── User Translation Preference (sub-doc; owned by identity-onboarding) ─────

export const UserTranslationPreferenceSchema = z.object({
  user_id: z.string().uuid(),
  preferred_language: z.string().min(2).max(5),
  auto_translate_enabled: z.boolean().default(false),
  auto_translate_threshold: z.number().min(0).max(1).default(0.8),
  updated_at: z.string().datetime(),
});
export type UserTranslationPreference = z.infer<typeof UserTranslationPreferenceSchema>;

// ─── API Request/Response Shapes ──────────────────────────────────────────────

export const RegisterWithEmailSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  display_name: z.string().min(2).max(60),
  nationality: z.string().length(2),
  preferred_language: z.string().min(2).max(5),
  gdpr_consent: z.literal(true),
});
export type RegisterWithEmailInput = z.infer<typeof RegisterWithEmailSchema>;

export const RegisterWithPhoneSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/), // E.164
  display_name: z.string().min(2).max(60),
  nationality: z.string().length(2),
  preferred_language: z.string().min(2).max(5),
  gdpr_consent: z.literal(true),
});
export type RegisterWithPhoneInput = z.infer<typeof RegisterWithPhoneSchema>;

export const LoginWithEmailSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});
export type LoginWithEmailInput = z.infer<typeof LoginWithEmailSchema>;

export const LoginWithPhoneSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  otp: z.string().length(6).regex(/^\d{6}$/),
});
export type LoginWithPhoneInput = z.infer<typeof LoginWithPhoneSchema>;

export const OAuthCallbackSchema = z.object({
  provider: z.enum(['GOOGLE', 'APPLE', 'FACEBOOK']),
  code: z.string().min(1).max(2048),
  state: z.string().min(1).max(512),
  redirect_uri: z.string().url(),
});
export type OAuthCallbackInput = z.infer<typeof OAuthCallbackSchema>;

export const UpdateProfileSchema = z.object({
  display_name: z.string().min(2).max(60).optional(),
  avatar_url: z.string().url().nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  nationality: z.string().length(2).optional(),
  preferred_language: z.string().min(2).max(5).optional(),
  languages_spoken: z.array(z.string().min(2).max(5)).optional(),
  travel_style: TravelStyleSchema.nullable().optional(),
  dietary_preferences: z.array(z.string()).optional(),
  accessibility_needs: z.array(z.string()).optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const ActivateEventSchema = z.object({
  event_id: z.string().uuid(),
  roles_for_event: z.array(UserRoleSchema).min(1),
  host_city_ids: z.array(z.string().uuid()).optional(),
});
export type ActivateEventInput = z.infer<typeof ActivateEventSchema>;

export const SelectRolesSchema = z.object({
  roles: z.array(UserRoleSchema).min(1).max(5),
});
export type SelectRolesInput = z.infer<typeof SelectRolesSchema>;

export const AuthTokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number().int().positive(),
  token_type: z.literal('Bearer'),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const AuthResponseSchema = z.object({
  user: FanProfileSchema,
  tokens: AuthTokensSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;