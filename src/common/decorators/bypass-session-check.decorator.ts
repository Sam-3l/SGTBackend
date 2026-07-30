import { SetMetadata } from "@nestjs/common";

// Marks a route as exempt from the "token's sessionId must match the
// account's current active_session_id" check in AuthGuard - the token still
// has to be validly signed and unexpired, we just don't require it to be the
// CURRENT session. Only meant for logout: logout's entire job is to free up
// a stuck/stale/mismatched session, so gating it behind "only the currently
// active session can call this" makes it impossible to ever recover from
// exactly the situation it exists to fix.
export const IS_BYPASS_SESSION_CHECK_KEY = 'bypassSessionCheck';

export const BypassSessionCheck = () => SetMetadata(IS_BYPASS_SESSION_CHECK_KEY, true);