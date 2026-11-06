import {describe, expect, it} from 'vitest';
import {render} from 'vitest-browser-svelte';
import {userEvent} from '@vitest/browser/context';
import {createRawSnippet} from 'svelte';
import IngredientConversions from './IngredientConversions.svelte';

const label = createRawSnippet(() => ({render: () => '<span>2 tbsp - honey</span>'}));

describe('IngredientConversions', () => {
    it('renders plain text when there is nothing to convert', async () => {
        const screen = render(IngredientConversions, {lines: [], children: label});
        await expect.element(screen.getByText('2 tbsp - honey')).toBeVisible();
        expect(screen.container.querySelector('button')).toBeNull();
    });

    it('shows the conversions when tapped and hides them on Escape', async () => {
        const screen = render(IngredientConversions, {lines: ['≈ 42 g', '≈ 30 ml'], children: label});
        const button = screen.getByRole('button');
        await button.click();
        await expect.element(screen.getByText('≈ 42 g')).toBeVisible();
        await expect.element(button).toHaveAttribute('aria-expanded', 'true');
        await userEvent.keyboard('{Escape}');
        expect(screen.container.textContent).not.toContain('≈ 42 g');
    });
});
