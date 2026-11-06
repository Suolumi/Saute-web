import {expect, it, vi} from 'vitest';
import {apiFetchJson} from './api';
import {getFamily} from './recipes';

vi.mock('./api', () => ({
    apiFetchJson: vi.fn(async () => ({response: {ok: true}, data: {items: []}})),
}));

it('getFamily asks for every variation the API allows in one page', async () => {
    await getFamily('root1', 'en');
    const listCall = vi.mocked(apiFetchJson).mock.calls.find(([path]) => path === '/recipes');
    expect(listCall?.[3]).toMatchObject({variation_of: 'root1', limit: 100});
});
