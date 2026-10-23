# Publicar na Vercel, manter o código e conteúdo no GitHub

O projeto tem duas entradas independentes: `node server/index.mjs` para uso local e `api/*.mjs` para Vercel Functions. Na Vercel, o disco não é usado para persistir o acervo: leitura e escrita usam o GitHub.

## Configuração do projeto

- Repositório: `BispoAugusto/Contos-de-M-stica-Worldbuilding`.
- Diretório raiz: a raiz do repositório.
- Framework: Other / nenhum.
- Node: 22.x.
- Build: `node scripts/build.mjs` (já definido em `vercel.json`).
- Diretório de saída: `dist`.
- Código do MVP está na branch `codex/worldbuilding-mvp` até revisão/merge. Uma publicação da `main` anterior ao merge contém apenas o README inicial.
- Defina a branch de produção explicitamente no painel. Ao usar `codex/worldbuilding-mvp` durante a revisão, depois mude para `main` quando a versão for incorporada.
- Preserve a proteção de deploys existente da Vercel. Não a desabilite para testar.

## Variáveis de ambiente de produção

| Variável | Valor/função |
| --- | --- |
| WORLD_PROVIDER | `github` (obrigatório na Vercel) |
| GITHUB_REPOSITORY | `BispoAugusto/Contos-de-M-stica-Worldbuilding` |
| GITHUB_BRANCH | `codex/worldbuilding-conteudo`, branch existente criada a partir da versão com `world/` |
| GITHUB_CONTENT_ROOT | `world` |
| GITHUB_TOKEN | Credencial restrita a este repositório com Contents read/write, cadastrada como Sensitive |
| APP_ORIGIN | URL HTTPS exata, sem barra final, do domínio principal do projeto |
| APP_ACCESS_KEY_SHA256 | SHA-256 da chave privada de autor, 64 caracteres hexadecimais |
| APP_SESSION_SECRET | 32 bytes aleatórios representados por 64 caracteres hexadecimais, cadastrado como Sensitive |

O token de instalação da integração GitHub/Vercel não é automaticamente uma credencial disponível em runtime. Não copie tokens do navegador nem os envie por chat. Cadastre `GITHUB_TOKEN` diretamente no ambiente do projeto na Vercel. Prefira GitHub App com credenciais curtas; um PAT fine-grained restrito é uma opção inicial, com rotação manual antes do vencimento.

Para gerar a chave de autor e o segredo de sessão **no seu terminal privado**, execute:

```sh
node --input-type=module -e "import { randomBytes, createHash } from 'node:crypto'; const key=randomBytes(32).toString('hex'); console.log('CHAVE_DO_AUTOR='+key); console.log('APP_ACCESS_KEY_SHA256='+createHash('sha256').update(key).digest('hex')); console.log('APP_SESSION_SECRET='+randomBytes(32).toString('hex'));"
```

Guarde `CHAVE_DO_AUTOR` no seu gerenciador de senhas. Ela é usada na tela de entrada do site; nunca use seu token GitHub nessa tela. Cadastre somente o hash da chave e o segredo de sessão nas variáveis correspondentes. Não versione ou anexe os valores gerados.

Após configurar/alterar variáveis, faça um novo deploy. Sem configuração completa, as funções retornam 503 sem revelar dados. Cada preview precisa de origem e segredos próprios ou ficará bloqueado; não use origens curingas.

## Autenticação e preservação do conteúdo

Uma chave aleatória de 256 bits autentica o autor. O servidor compara seu hash em tempo constante e entrega um cookie assinado de oito horas, HttpOnly, Secure e SameSite=Strict. O token CSRF deriva da sessão assinada e funciona entre instâncias sem estado compartilhado. As APIs de leitura e escrita exigem sessão válida. A parte estática pública contém apenas interface e código de apresentação, nunca Markdown do acervo.

Trata-se de acesso privado para um único autor, não de contas individuais de jogadores. Sair apaga o cookie do navegador; uma cópia roubada continua válida até a expiração. Troque `APP_SESSION_SECRET` e faça redeploy para revogar todas as sessões. A chave precisa ser aleatória e ter 64 caracteres hexadecimais; senhas humanas não são aceitas. Não existe cadastro, recuperação de senha ou rate limiting distribuído próprio; preserve as proteções da plataforma e avalie um provedor de identidade antes de abrir para vários usuários.

O GitHub continua sendo a fonte persistente. Gravações usam SHA para não sobrescrever a versão do mesmo arquivo. A fila do processo não coordena instâncias diferentes: evite edições simultâneas de arquivos relacionados até implementar commits atômicos de múltiplos arquivos/validação sobre uma versão fixa do acervo. A checagem de IDs/pilares entre arquivos não é uma transação distribuída.

Mantenha a branch de conteúdo separada da branch de produção do código. Configure o Git da Vercel para não criar previews da branch de conteúdo se não quiser builds a cada anotação. Nenhuma regra de publicação de conteúdo canônico é inferida do deploy do aplicativo.

## Validação antes de disponibilizar

1. Build e testes passam.
2. API do domínio de produção retorna 401 sem cookie; nenhuma lista de documentos vaza.
3. Login funciona e o cookie tem os atributos descritos.
4. Um documento de teste explicitamente não canônico pode ser criado na branch de conteúdo e lido após novo acesso.
5. Credenciais não aparecem em arquivos de `dist/`, respostas HTTP ou logs.

Referências oficiais: [Vercel Functions Node.js](https://vercel.com/docs/functions/runtimes/node-js), [configuração do projeto](https://vercel.com/docs/project-configuration/vercel-json).
