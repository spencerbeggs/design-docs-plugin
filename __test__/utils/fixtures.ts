/**
 * Shared test fixtures for plugin tests.
 *
 * This default state represents what setup() would produce from default options:
 *   - GREETING="Hello" → greetingPrefix="Hello"
 *   - CONTEXT_ENABLED="true" → contextEnabled=true
 *   - NODE_ENV unset → environment="development"
 */
export const defaultState = {
	environment: "test",
	greetingPrefix: "Hello",
	contextEnabled: true,
};
