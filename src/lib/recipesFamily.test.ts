import {expect, it, vi} from 'vitest';
import {apiFetchJson} from './api';
import {getFamily} from './recipes';

vi.mock('./api', () => ({
    apiFetchJson: vi.fn(async () => ({response: {ok: true}, data: {items: []}})),
}));

it('getFamily asks for every member of the family in one request', async () => {
    await getFamily('F', 'en');
    const calls = vi.mocked(apiFetchJson).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('/recipes');
    expect(calls[0][3]).toMatchObject({family: 'F', limit: 100});
    expect(calls[0][3]).not.toHaveProperty('variation_of');
});
