# Modelo de segurança

O MVP é uma ferramenta local para um autor, não um serviço público. Ele escuta apenas `127.0.0.1`. Não abra túnel, não altere para `0.0.0.0` e não publique em hospedagem antes de implementar autenticação e autorização remotas.

O limite de confiança inclui o usuário do computador: programas locais podem acessar o servidor. O nonce CSRF não autentica usuários; bloqueia gravações iniciadas por páginas de outros sites. O servidor verifica Host exato, Origin quando presente e Fetch Metadata. Não habilita CORS. Estáticos vêm de lista explícita; `.env` e arquivos do servidor não são servidos. CSP sem scripts inline, sem frames e sem fontes externas.

Credencial GitHub fica somente no ambiente do processo e nunca é devolvida pela API. A conexão GitHub desta conversa não é reutilizada pelo aplicativo: configure uma credencial própria no servidor para execução remota. Não a coloque em campos do navegador. `.env` é ignorado pelo Git; não o envie em anexos.

O modo GitHub permite apenas branch com prefixo `codex/worldbuilding-`. Configuração precisa apontar a raiz de conteúdo, não a raiz de código. Revisão e merge são feitos no GitHub pelo autor. O MVP não cria branches, PRs ou publica conteúdo por conta própria durante execução.

Não há acesso de jogadores: todos os arquivos configurados são retornados ao operador. `visibility` é metadado, não controle de acesso. Um futuro modo jogador precisa filtrar no servidor antes da indexação, inclusive backlinks, mapas e contexto de IA.

Markdown é renderizado por nós de texto e elementos permitidos, sem `innerHTML`. Protocolos de links fora de HTTP(S)/referências locais são bloqueados. Imagens e HTML importados permanecem texto.

Conflitos retornam 409/422 sem substituir o rascunho. Validação estrutural bloqueia gravação de frontmatter inválido, IDs repetidos ou referências a pilares inexistentes. No MVP, erros estruturais em qualquer documento do acervo bloqueiam gravações até serem corrigidos; diagnóstico aponta arquivos. Revise/importações antes de usar um acervo legado.

O adaptador GitHub foi testado com respostas simuladas. Exercitar escrita real pela aplicação requer credencial de runtime e branch/raiz preparadas. O envio do código pelo conector da conversa é uma operação distinta.
