# Servidor

O servidor local é exclusivo do autor: mantenha bind em `127.0.0.1`. O adaptador Vercel é separado, exige provedor GitHub, origem HTTPS fixa, autenticação de autor e cookie HttpOnly/Secure. Mantenha Host exato, política de origem, CSRF e lista explícita de arquivos estáticos em ambos.
Nunca crie um proxy genérico para URLs ou repositórios enviados pelo navegador.
O provedor só pode acessar a raiz configurada. Rejeite traversal, links simbólicos e caminhos inválidos no Windows.
Escritas usam a versão lida. Nunca implemente retry de conflito sobrescrevendo a versão mais recente.
Não retorne respostas brutas do GitHub com informações sensíveis. Teste que tokens não chegam ao cliente.
Sessões e CSRF hospedados precisam funcionar entre instâncias e cold starts. Nunca use estado em memória como única autenticação remota. Não devolva chave de acesso, hash ou segredo de sessão na API. Não faça downgrade para modo local se faltar configuração de hospedagem.
