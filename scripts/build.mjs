import { mkdir, copyFile, lstat, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Only these client assets may be published. Never copy world/, .env or server/.
const root = new URL('../', import.meta.url);
const output = fileURLToPath(new URL('dist/', root));
if (path.dirname(path.resolve(output)) !== path.resolve(fileURLToPath(root))) throw new Error('Diretório de saída inválido.');
try { if ((await lstat(output)).isSymbolicLink()) throw new Error('dist não pode ser um link simbólico.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await rm(output, { recursive: true, force: true });
await mkdir(new URL('dist/shared/', root), { recursive: true });
for (const [from, to] of [['web/index.html', 'dist/index.html'], ['web/app.mjs', 'dist/app.mjs'], ['web/style.css', 'dist/style.css'], ['shared/domain.mjs', 'dist/shared/domain.mjs']]) await copyFile(new URL(from, root), new URL(to, root));
console.log('Build concluído: quatro arquivos públicos; conteúdo e segredos ficam no servidor.');
