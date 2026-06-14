import { Router } from 'express';
import { identityController } from './identity.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import {
  RegisterWithEmailSchema,
  RegisterWithPhoneSchema,
  OAuthCallbackSchema,
  OnboardingProfileSchema,
  UpdateProfileSchema,
  ActivateEventSchema,
  AddRoleSchema,
  LoginSchema,
  VerifyEmailSchema,
  VerifyPhoneSchema,
} from '@roarpass/shared';

const router = Router();

// ─── Auth / Registration ─────────────────────────────────────────────────────
router.post(
  '/auth/register/email',
  validate(RegisterWithEmailSchema),
  identityController.registerWithEmail,
);

router.post(
  '/auth/register/phone',
  validate(RegisterWithPhoneSchema),
  identityController.registerWithPhone,
);

router.post(
  '/auth/oauth/callback',
  validate(OAuthCallbackSchema),
  identityController.oauthCallback,
);

router.post(
  '/auth/login',
  validate(LoginSchema),
  identityController.login,
);

router.post('/auth/refresh', identityController.refreshToken);
router.post('/auth/logout', authenticate, identityController.logout);

// ─── Verification ────────────────────────────────────────────────────────────
router.post(
  '/auth/verify/email',
  validate(VerifyEmailSchema),
  identityController.verifyEmail,
);

router.post(
  '/auth/verify/phone',
  validate(VerifyPhoneSchema),
  identityController.verifyPhone,
);

router.post(
  '/auth/verify/phone/request',
  authenticate,
  identityController.requestPhoneOtp,
);

// ─── Profile ──────────────────────────────────────────────────────────────────
router.get('/profile/me', authenticate, identityController.getMyProfile);

router.patch(
  '/profile/me',
  authenticate,
  validate(UpdateProfileSchema),
  identityController.updateProfile,
);

router.post(
  '/profile/me/onboarding',
  authenticate,
  validate(OnboardingProfileSchema),
  identityController.completeOnboarding,
);

// ─── Event Activation ────────────────────────────────────────────────────────
router.post(
  '/profile/me/event-activations',
  authenticate,
  validate(ActivateEventSchema),
  identityController.activateEvent,
);

router.get(
  '/profile/me/event-activations',
  authenticate,
  identityController.listEventActivations,
);

// ─── Roles ───────────────────────────────────────────────────────────────────
router.post(
  '/profile/me/roles',
  authenticate,
  validate(AddRoleSchema),
  identityController.addRole,
);

// ─── GDPR / Data Subject Rights ──────────────────────────────────────────────
router.get('/profile/me/export', authenticate, identityController.exportData);
router.delete('/profile/me', authenticate, identityController.deleteAccount);

// ─── Admin ────────────────────────────────────────────────────────────────────
router.get(
  '/admin/users',
  authenticate,
  requireRole('ADMIN'),
  identityController.adminListUsers,
);

router.get(
  '/admin/users/:userId',
  authenticate,
  requireRole('ADMIN'),
  identityController.adminGetUser,
);

router.patch(
  '/admin/users/:userId/status',
  authenticate,
  requireRole('ADMIN'),
  identityController.adminUpdateUserStatus,
);

export { router as identityRouter };