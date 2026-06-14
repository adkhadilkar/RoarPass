// Shared role enum — main added 'local_helper'; partner branch added
// 'business_partner'. Both preserved; values kept stable for existing tokens.
export enum UserRole {
  Fan = 'fan',
  LocalHelper = 'local_helper',
  BusinessPartner = 'business_partner',
  Admin = 'admin',
}

// Authorization scopes referenced by middleware in both branches.
export const ROLE_SCOPES: Record<UserRole, string[]> = {
  [UserRole.Fan]: ['fan:read', 'fan:write', 'trips:join'],
  [UserRole.LocalHelper]: ['helper:read', 'helper:write', 'trips:assist'],
  [UserRole.BusinessPartner]: [
    'partner:read',
    'partner:write',
    'offers:manage',
  ],
  [UserRole.Admin]: ['*'],
};