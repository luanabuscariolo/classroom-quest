# Segurança e privacidade

## Modelo atual

TIC Quest é uma aplicação local no navegador servida por um site estático. Não envia nomes, presenças ou notas para uma API; não contém analytics, CDN ou dependências JavaScript remotas. O fornecedor de alojamento recebe os pedidos normais dos ficheiros do site.

Os perfis de professor não são contas. Quem usa o mesmo perfil do navegador/origem pode ler ou alterar as turmas. `localStorage`, a cópia anterior e backups JSON não são cifrados. Um site público não publica automaticamente os dados que cada professor introduz, mas qualquer ficheiro pessoal incluído no repositório ou diretório publicado pode ficar público.

Projetos GitHub Pages no mesmo domínio partilham a origem: o caminho `/outro-projeto/` não constitui uma barreira de armazenamento. Evite código não confiável na mesma origem e não trate este desenho como isolamento entre professores.

## Proteções existentes

- Importações limitadas a 20 MiB por ficheiro e texto, antes do parsing.
- Validação de versões, tipos, intervalos, tamanhos, referências e identificadores repetidos.
- Texto de utilizador inserido como texto, sem `innerHTML` ou `eval`.
- CSP restringe scripts e imagens à própria origem e proíbe ligações de dados, plugins e submissões de formulários. Estilos inline continuam permitidos para animações e posicionamento dinâmico.
- Conflitos de armazenamento e erros de quota interrompem a gravação e mostram avisos.
- Apresentação espelha apenas a interface pública; o teste verifica que o diário não aparece.

O checksum FNV deteta alterações acidentais; **não é uma assinatura, cifragem ou prova de autenticidade**. A validação de estrutura continua indispensável.

CSP em `meta` não suporta todas as opções de cabeçalhos HTTP, incluindo `frame-ancestors`. Referência: [Content-Security-Policy na MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy).

## Utilização e comunicação de falhas

Utilize um perfil de navegador protegido e guarde backups num local com acesso controlado. O relatório do dia completo inclui notas privadas. Os backups não são enviados automaticamente para lado nenhum.

Comunique falhas com reproduções usando dados fictícios. Não publique backups ou nomes de alunos numa issue pública. Esta revisão de código e testes não equivale a uma auditoria independente de segurança.
