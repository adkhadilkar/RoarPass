/**
 * Enum definitions re-exported for schema use (avoids circular imports with types/identity.ts)
 */
export enum UserRole {
  FAN = 'FAN',
  LOCAL_HELPER = 'LOCAL_HELPER',
  BUSINESS_PARTNER = 'BUSINESS_PARTNER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
}

export enum AuthProvider {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  GOOGLE = 'GOOGLE',
  APPLE = 'APPLE',
  FACEBOOK = 'FACEBOOK',
}

export enum TravelStyle {
  BUDGET = 'BUDGET',
  MID_RANGE = 'MID_RANGE',
  LUXURY = 'LUXURY',
}