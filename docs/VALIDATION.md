# Validação da entrega inicial

Executado em 23/10/2026 com Node 24.22.1, em Windows.

- 12 testes automatizados aprovados: parser, vínculos, backlinks, IDs/pilares, caminhos, Unicode, gravações concorrentes, conflito de versão, confirmação editorial, Host/origem/CSRF, arquivos privados, limite de tamanho e adaptador GitHub com respostas simuladas.
- Servidor local respondeu HTTP 200; navegador carregou a aplicação sem instalação de dependências.
- Verificação pelo navegador: leitura, navegação por wikilink, edição e salvamento de um exemplo, restauração do texto original, grafo e busca.
- Visual conferido na largura estreita do painel do aplicativo. A folha de estilos contém layout amplo e estreito; não foi feita uma matriz completa de navegadores/dispositivos.
- Sintaxe dos módulos cliente e servidor verificada com `node --check`.

O sandbox bloqueou rede loopback e rename na primeira execução; os testes foram repetidos fora dessas restrições e passaram. Um teste de Host usava `fetch`, que não enviou o Host simulado: foi corrigido para usar uma requisição HTTP com cabeçalho explícito e confirmou 403.

Não foi feita escrita no GitHub através da credencial de runtime do aplicativo, pois essa credencial ainda não está configurada. O código será enviado pelo conector GitHub desta conversa; isso valida acesso ao repositório, mas não substitui um teste real do adaptador no ambiente final.

Mapas, Canvas, IA, autenticação multiusuário e operações de mover/renomear/excluir estão fora desta entrega inicial e não devem ser anunciados como disponíveis.

## Adaptação Vercel

Em 23/10/2026, o conjunto passou a 16 testes aprovados. Os quatro novos testes verificam bloqueio sem autenticação, origem/chave de login, atributos do cookie, assinatura/expiração, CSRF entre sessões e funcionamento entre instâncias sem estado compartilhado. O build gera somente os quatro arquivos públicos previstos. O adaptador aceita corpo já processado pela plataforma.

Isso verifica a implementação localmente; uma publicação Vercel funcional ainda precisa ser confirmada no domínio real, com acesso à conta e variáveis privadas configuradas. Não confundir build local com deploy concluído.
