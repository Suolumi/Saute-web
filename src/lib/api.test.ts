import {describe, expect, it} from 'vitest';
import {apiErrorReason, apiFetch, NETWORK_ERROR_CODE} from './api';

const res = (status: number) => new Response(null, {status});

describe('apiErrorReason', () => {
    it('maps a network failure to the network reason', () => {
        expect(apiErrorReason(res(503), {code: NETWORK_ERROR_CODE})).toEqual({key: 'apiErrors.network'});
    });

    it('maps auth, permission, missing and rate-limit statuses to localized reasons', () => {
        expect(apiErrorReason(res(401), {error: 'Incorrect username or password'})).toEqual({key: 'apiErrors.unauthorized'});
        expect(apiErrorReason(res(403))).toEqual({key: 'apiErrors.forbidden'});
        expect(apiErrorReason(res(404))).toEqual({key: 'apiErrors.notFound'});
        expect(apiErrorReason(res(413))).toEqual({key: 'apiErrors.tooLarge'});
        expect(apiErrorReason(res(429))).toEqual({key: 'apiErrors.rateLimited'});
    });

    it('never shows a server error message', () => {
        expect(apiErrorReason(res(500), {error: 'Could not get user'})).toEqual({key: 'apiErrors.server'});
    });

    it('shows the server message for validation errors', () => {
        expect(apiErrorReason(res(409), {error: ' Name already taken '})).toEqual({detail: 'Name already taken'});
        expect(apiErrorReason(res(422), {error: 'unknown tag'})).toEqual({detail: 'unknown tag'});
    });

    it('has no reason for a validation error without a message', () => {
        expect(apiErrorReason(res(400), {})).toBeNull();
        expect(apiErrorReason(res(400), 'not an object')).toBeNull();
    });
});

describe('apiFetch', () => {
    it('turns a failed fetch into a network-error response', async () => {
        const failing = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch;
        const response = await apiFetch('/recipes', 'GET', null, null, undefined, failing);
        expect(response.ok).toBe(false);
        expect(apiErrorReason(response, await response.json())).toEqual({key: 'apiErrors.network'});
    });

    it('still throws on abort', async () => {
        const aborting = (() => Promise.reject(new DOMException('aborted', 'AbortError'))) as typeof fetch;
        await expect(apiFetch('/recipes', 'GET', null, null, undefined, aborting)).rejects.toThrow('aborted');
    });
});
