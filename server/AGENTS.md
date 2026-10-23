# Servidor

O servidor é local e exclusivo do autor. Mantenha bind em `127.0.0.1`, Host exato, política de origem, CSRF e lista explícita de arquivos estáticos.
Nunca crie um proxy genérico para URLs ou repositórios enviados pelo navegador.
O provedor só pode acessar a raiz configurada. Rejeite traversal, links simbólicos e caminhos inválidos no Windows.
Escritas usam a versão lida. Nunca implemente retry de conflito sobrescrevendo a versão mais recente.
Não retorne respostas brutas do GitHub com informações sensíveis. Teste que tokens não chegam ao cliente.
