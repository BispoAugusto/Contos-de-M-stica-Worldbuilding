# Contos de Mística · Ateliê de worldbuilding

MVP de navegador/editor Markdown com vínculos, grafo, entidades e proteção editorial do cânone. O repositório estava vazio quando inspecionado em 23/10/2026; nenhum conteúdo narrativo foi migrado ou inventado.

## Executar

Requer Node.js 22 ou mais recente. Sem dependências ou etapa de instalação.

```sh
node server/index.mjs
```

Abra **http://127.0.0.1:4173**. O padrão abre `examples/world/`, explicitamente não canônico. Salvamentos alteram esses arquivos de exemplo no disco.

Para abrir o diretório reservado ao conteúdo do autor, no PowerShell:

```powershell
$env:WORLD_ROOT = (Resolve-Path ./world).Path
node server/index.mjs
```

Ou copie `.env.example` para `.env`, configure caminhos no servidor e execute:

```sh
node --env-file=.env server/index.mjs
```

## GitHub

Crie uma branch `codex/worldbuilding-...` a partir da versão atual no GitHub. Configure `.env` no servidor:

```dotenv
WORLD_PROVIDER=github
GITHUB_REPOSITORY=BispoAugusto/Contos-de-M-stica-Worldbuilding
GITHUB_BRANCH=codex/worldbuilding-conteudo
GITHUB_CONTENT_ROOT=world
# Configure GITHUB_TOKEN somente no servidor, nunca no cliente ou no Git.
```

Use uma credencial restrita a esse repositório com Contents read/write. A branch precisa existir; o app não a cria. O token usado nesta conversa não é transferido para o aplicativo. Novos documentos e alterações geram commits na branch configurada; revise-os por PR antes de incorporar ao cânone.

## Entrega atual

- Navegador de arquivos, pesquisa, filtros de entidades, leitura/edição e criação de Markdown.
- Links Markdown e `[[wikilinks|alias]]`, backlinks, alertas e grafo navegável.
- Metadados opcionais, referência a pilares por ID, status editorial e confirmação para alterar cânone/pilares.
- Provedores local e GitHub; token só no servidor, caminhos restritos e conflitos de versão.
- Instruções para agentes, arquitetura, modelo de segurança e contratos para mapas/Canvas/IA.

Limites: Markdown básico e subconjunto explícito de YAML; sem mover, renomear ou excluir; mapas, Canvas e IA ainda não implementados. Somente uso local pelo autor, sem autenticação remota nem acesso de jogadores. Consulte [arquitetura](docs/ARCHITECTURE.md) e [segurança](docs/SECURITY.md) antes de ampliar ou hospedar.

## Verificar

```sh
node --test tests/*.test.mjs
```

Não há pilares ou fatos canônicos iniciais. `world/` é reservado ao autor; `examples/` contém apenas orientações neutras de demonstração. Leia [AGENTS.md](AGENTS.md) antes de colaborar.
