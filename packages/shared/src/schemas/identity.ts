/**
 * Zod validation schemas for identity-onboarding
 */
import { z } from 'zod';
import {
  AuthProvider,
  TravelStyle,
  UserRole,
} from './identity-enums';

// Re-export enums for convenience
export { AuthProvider, TravelStyle, UserRole };

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const isoLanguage = z
  .string()
  .regex(/^[a-z]{2,3}$/, 'Must be ISO 639-1 language code');

const isoCountry = z
  .string()
  .regex(/^[A-Z]{2}$/, 'Must be ISO 3166-1 alpha-2 country code');

const e164Phone = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Must be E.164 format (e.g. +12125551234)');

const strongPassword = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[0-9]/, 'Must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Must contain a special character');

// ---------------------------------------------------------------------------
// Registration schemas
// ---------------------------------------------------------------------------

export const RegisterEmailSchema = z.object({
  email: z.string().email('Invalid email address').max(254),
  password: strongPassword,
  display_name: z.string().min(2).max(50).trim(),
  nationality: isoCountry,
  preferred_language: isoLanguage,
  terms_accepted: z.literal(true, {
    errorMap: () => ({ message: 'Terms must be accepted' }),
  }),
  privacy_policy_accepted: z.literal(true, {
    errorMap: () => ({ message: 'Privacy policy must be accepted' }),
  }),
  marketing_consent: z.boolean().optional().default(false),
});

export const RegisterPhoneSchema = z.object({
  phone_e164: e164Phone,
  display_name: z.string().min(2).max(50).trim(),
  nationality: isoCountry,
  preferred_language: isoLanguage,
  terms_accepted: z.literal(true, {
    errorMap: () => ({ message: 'Terms must be accepted' }),
  }),
  privacy_policy_accepted: z.literal(true, {
    errorMap: () => ({ message: 'Privacy policy must be accepted' }),
  }),
  marketing_consent: z.boolean().optional().default(false),
});

export const LoginEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const LoginPhoneSchema = z.object({
  phone_e164: e164Phone,
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/),
});

export const SendOtpSchema = z.object({
  phone_e164: e164Phone,
});

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const VerifyPhoneSchema = z.object({
  phone_e164: e164Phone,
  otp: z.string().length(6).regex(/^\d{6}$/),
});

export const ResetPasswordSchema = z.object({
  email: z.string().email(),
});

export const ConfirmResetPasswordSchema = z.object({
  token: z.string().min(1),
  new_password: strongPassword,
});

export const RefreshTokenSchema = z.object({
  refresh_token: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Profile update schemas
// ---------------------------------------------------------------------------

export const SupportedTeamSchema = z.object({
  team_id: z.string().uuid(),
  team_name: z.string().min(1).max(100),
  country_code: isoCountry,
  sport: z.string().min(1).max(50),
});

export const PrivacySettingsSchema = z.object({
  profile_visibility: z.enum(['PUBLIC', 'COMMUNITY', 'PRIVATE']).optional(),
  show_nationality: z.boolean().optional(),
  show_teams: z.boolean().optional(),
  show_travel_style: z.boolean().optional(),
  discoverable_for_matching: z.boolean().optional(),
});

export const UpdateProfileSchema = z.object({
  display_name: z.string().min(2).max(50).trim().optional(),
  avatar_url: z.string().url().max(2048).nullable().optional(),
  nationality: isoCountry.optional(),
  country_of_residence: isoCountry.optional(),
  preferred_language: isoLanguage.optional(),
  languages_spoken: z.array(isoLanguage).max(20).optional(),
  supported_teams: z.array(SupportedTeamSchema).max(10).optional(),
  travel_style: z.nativeEnum(TravelStyle).nullable().optional(),
  dietary_preferences: z.array(z.string().max(50)).max(20).optional(),
  accessibility_needs: z.array(z.string().max(100)).max(20).optional(),
  privacy_settings: PrivacySettingsSchema.optional(),
});

export const UpdateRolesSchema = z.object({
  roles: z
    .array(z.nativeEnum(UserRole))
    .min(1, 'At least one role required')
    .max(5)
    .refine(
      (roles) => roles.includes(UserRole.FAN),
      'FAN role is always required'
    ),
});

// ---------------------------------------------------------------------------
// Event activation
// ---------------------------------------------------------------------------

export const ActivateEventSchema = z.object({
  event_id: z.string().uuid(),
  host_cities: z.array(z.string().uuid()).min(1).max(50),
  attending_matches: z.array(z.string().uuid()).max(200),
});

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------

export const DeleteAccountSchema = z.object({
  confirmation: z.literal('DELETE_MY_ACCOUNT'),
  reason: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type RegisterEmailInput = z.infer<typeof RegisterEmailSchema>;
export type RegisterPhoneInput = z.infer<typeof RegisterPhoneSchema>;
export type LoginEmailInput = z.infer<typeof LoginEmailSchema>;
export type LoginPhoneInput = z.infer<typeof LoginPhoneSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type UpdateRolesInput = z.infer<typeof UpdateRolesSchema>;
export type ActivateEventInput = z.infer<typeof ActivateEventSchema>;