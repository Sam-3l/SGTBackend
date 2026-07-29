const PAGINATION = {
    DEFAULT_PAGE_NUMBER: 1,

    DEFAULT_LIMIT: 50
};

// Max lifetime of a single active session, in seconds, before it self-clears.
// Covers logout never being called (crash, cleared browser data, closed tab
// mid-request, a frontend bug like the one that prompted this) - without
// this, a stuck activeSessionId would lock a paying user out permanently
// since there'd be no automatic way back in.
const SESSION = {
    ACTIVE_SESSION_TTL_SECONDS: 24 * 60 * 60, // 24 hours
    ACTIVE_SESSION_TTL_JWT: '24h'
};

export default {
    PAGINATION,
    SESSION
};