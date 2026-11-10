// Copies the shared nutrition fixture from Saute-api (the source of truth)
// and records its hash, which src/lib/nutritionCompute.test.ts checks.
// Usage: npm run sync:nutrition-fixtures [-- /path/to/Saute-api]
import {createHash} from 'node:crypto';
import {copyFileSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const apiDir = resolve(process.argv[2] ?? '../Saute-api');
const source = resolve(apiDir, 'internal/recipe_service/testdata/nutrition_cases.json');
const target = resolve('src/lib/testdata/nutrition_cases.json');

copyFileSync(source, target);
const hash = createHash('sha256').update(readFileSync(target)).digest('hex');
writeFileSync(`${target}.sha256`, `${hash}\n`);
console.log(`Synced ${source} (sha256 ${hash})`);
