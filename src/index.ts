// Public barrel — merged exports.
// Existing community/event exports preserved; onboarding/auth exports added.

export * from './types';

// Pre-existing modules
export { createEvent, listEvents } from './events';
export { joinCountryCommunity, listCountryCommunities } from './communities';

// identity-onboarding modules
export { signIn, signOut, getCurrentFanProfile } from './auth';
export { startOnboarding, advanceOnboarding, completeOnboarding } from './onboarding';