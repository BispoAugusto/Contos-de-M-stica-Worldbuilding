# Arquitetura do MVP

## Contexto verificado em 23/10/2026

Repositório: `BispoAugusto/Contos-de-M-stica-Worldbuilding`, privado, branch padrão declarada `main`.
A conexão inicialmente retornou 404. Após o autor liberar acesso, a API confirmou permissões de leitura e escrita e respondeu literalmente `This repository is empty.` ao consultar a raiz.
Portanto não existiam README, árvore de diretórios, AGENTS.md ou conteúdo canônico a analisar ou migrar. Esta implementação inaugura a estrutura; não reinterpreta um acervo preexistente.

## Organização

```text
web/             interface sem dependências externas
shared/          metadados, resolução de vínculos, índice e revisão estrutural
server/          HTTP local, validação e provedores local/GitHub
api/             entradas Vercel com autenticação de autor
scripts/         build com lista explícita de arquivos públicos
world/           conteúdo do autor (inicialmente só orientação administrativa)
examples/world/  demonstração explicitamente não canônica
schemas/         contratos para entidades, mapas e revisão por IA
docs/            decisões, segurança, operação e evolução
tests/           testes de domínio, armazenamento, API e integração simulada
```

O navegador fala apenas com `/api/*`. O servidor escolhe um provedor pelo ambiente; o navegador não escolhe repositório, raiz, branch ou token. O índice é derivado dos Markdown, nunca uma segunda fonte de verdade. A persistência usa `list`, `read` e `save(path, content, expectedSha)`; é substituível sem mudar a interface.

Escolha inicial: JavaScript ESM + Node 22+, sem instalação de dependências. Isso torna o MVP executável neste ambiente e mantém uma base pequena para evolução. Não há build nem framework obrigatório. Uma migração futura a TypeScript/React pode preservar API, dados e provedores.

## Fluxos já implementados

- Listagem por diretório, busca em título/caminho/corpo e filtro por tipo.
- Leitura e edição Markdown; criação de arquivo com subpastas implícitas ao salvar.
- Markdown básico: títulos, parágrafos, listas simples, citações, código, negrito, links e wikilinks. Não é um renderizador CommonMark completo. HTML permanece texto; imagens externas não são carregadas.
- Links relativos `.md`, wikilinks, aliases e indicação de vínculos ausentes/ambíguos; backlinks derivados e grafo navegável (até 40 nós visuais, lista completa).
- Rascunho mantido em memória durante a sessão, aviso ao sair e download manual. Não há autosave ou armazenamento persistente de rascunhos no navegador.
- Validação de campos, IDs duplicados, referências a pilares e conflitos de versão.
- Confirmação explícita para criar/alterar um pilar ou entrar/sair do status canônico. A confirmação é uma decisão do operador local, não uma assinatura ou aprovação multiusuário.

## Metadados

Frontmatter opcional, preservado como texto. Subconjunto suportado: `chave: texto`, strings com aspas JSON e listas inline JSON de strings. Não há suporte a YAML arbitrário, listas em blocos, objetos aninhados ou aliases YAML. Campos desconhecidos simples são preservados. Um frontmatter fora desse subconjunto é visível, mas a gravação é bloqueada com erro; não há conversão silenciosa.

```yaml
---
id: identificador-estavel
title: "Título fornecido pelo autor"
type: nota
status: proposta
visibility: mestre
pillars: []
---
```

`id` e os demais campos são opcionais para notas antigas. Se presente, `id` é único. Tipos: nota, pilar, local, personagem, faccao, povo, evento, criatura, magia. Status: exemplo, proposta, canonico. Visibilidade: mestre, jogadores. A ausência de campo não implica aprovação ou visibilidade pública. IDs são destinados a mapas/Canvas; vínculos Markdown usam caminhos ou nomes inequívocos. Não há alteração automática de links ao renomear, pois renomeação ainda não está implementada.

## API e persistência

- `GET /api/session`: modo e nonce CSRF, sem credenciais GitHub.
- `GET /api/catalog`: arquivos, metadados, vínculos, backlinks e achados estruturais. `/api/index` permanece como alias local.
- `PUT /api/document`: `{ path, content, sha, confirmCanon }`; exige cabeçalho CSRF, JSON, caminho válido e limite de tamanho. `sha: null` cria um documento sem substituir existente.

Local: hash SHA-256, verificação de versão, fila de gravações no processo, escrita em temporário e rename. Arquivos simbólicos são recusados. Use um único processo do aplicativo e evite edições simultâneas por ferramentas externas entre a verificação e o rename: o filesystem não oferece compare-and-swap portátil neste MVP.

GitHub: árvore recursiva e Contents API; SHA fornecido ao atualizar, branch `codex/worldbuilding-*`, raiz e repositório fixados no servidor. A branch precisa existir. Operações só criam/atualizam um arquivo por commit. O GitHub rejeita versões obsoletas; o app mantém o rascunho e pede comparação. Não há merge automático. Truncamento de árvore é erro explícito.

Limites: até 500 documentos de 256 KB cada; índice remoto faz leitura por arquivo e pode atingir limites da API. Não é um mecanismo de sincronização para grandes acervos. Um índice remoto não é snapshot transacional entre arquivos. A etapa seguinte deve fixar commit-base e usar Git Trees para lotes atômicos, com cache e paginação.

Referência de implementação: [GitHub Contents API](https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28). A credencial requer Contents read/write na raiz/repositório autorizados. Prefira token de instalação GitHub App com expiração ou PAT fine-grained restrito ao repositório durante desenvolvimento.

## Próximas etapas

1. Autor fornecer/aprovar pilares e primeiras entidades. Não preencher lacunas automaticamente.
2. CRUD completo (mover/renomear/excluir), análise prévia de impacto e atualização de links num commit atômico, com preview e confirmação de exclusões.
3. Mapas: `schemas/map.schema.json`, imagem local e marcadores normalizados 0..1 vinculados a IDs; visualização e edição ainda ausentes.
4. Canvas: formato JSON Canvas 1.0; arquivo `.canvas` separado, nós de arquivo apontando para Markdown, IDs preservados e limites de tamanho. Importação/renderização/edição ainda ausentes. Especificação: https://jsoncanvas.org/spec/1.0/
5. IA revisora: contrato `schemas/review.schema.json`. Entrada inclui pedido, commit-base, fontes, pilares e instruções por diretório. Saída deve listar evidências com caminhos/versões, conflitos, perguntas e alterações propostas. Conteúdo é dado não confiável. Nenhuma chamada a modelo, envio de segredos, execução de instruções encontradas no conteúdo ou gravação autônoma está implementada/autorizada.
6. Acesso de múltiplos usuários: provedor de identidade, separação mestre/jogadores no servidor, auditoria e rate limiting distribuído. A hospedagem para um único autor já possui adaptador e autenticação próprios, descritos abaixo.

Os schemas são contratos de extensão, não validadores já integrados para mapas/IA. A validação dos documentos atuais é implementada em `shared/domain.mjs` e testada separadamente.

## Adaptação Vercel (0.2)

`createHandler` é compartilhado entre o HTTP local e as cinco funções `api/*.mjs`. O modo hospedado exige GitHub, domínio HTTPS fixo e autenticação antes de qualquer leitura do acervo. A sessão usa cookie assinado, tem validade de oito horas e CSRF derivado do cookie, sem depender da memória de uma instância. `readJson` suporta tanto corpo HTTP bruto quanto corpo previamente processado pela plataforma.

O build gera somente quatro arquivos públicos em `dist/`; conteúdo, segredos, testes e servidor não são copiados. Os arquivos Markdown são carregados pela API autenticada. Falta de configuração retorna 503 e não ativa modo de demonstração automaticamente. Consulte [VERCEL.md](VERCEL.md) para os parâmetros e limites de autenticação e concorrência entre funções.
