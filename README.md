# TIC Quest · Classroom Quest

Jogo de sala de aula para professores: turmas, avatares, pontos, vidas, sorteios, equipas, diário e apresentação numa segunda janela.

Aplicação estática, sem servidor de dados, contas ou serviços externos. O navegador executa módulos JavaScript nativos; não há framework nem dependências de produção. Os dados são guardados no navegador e exportados em backups JSON.

## Desenvolvimento local

Requisito: Node.js 24 ou superior.

```sh
npm ci
npm run dev
```

Abrir <http://127.0.0.1:4173/classroom-quest/>. O prefixo simula um site de projeto no GitHub Pages. O servidor escuta apenas no computador local e serve apenas os ficheiros da aplicação. A variável de ambiente `PORT` permite alterar a porta.

Use HTTP local, não um duplo clique em `index.html`: módulos ES precisam de um servidor. A entrada da aplicação é `index.html`.

## Organização

| Local                                            | Responsabilidade                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| `index.html`                                     | Estrutura da interface, sem CSS ou JavaScript embutido                |
| `assets/css/`                                    | Estilos por área: base, feedback, jogo, gestão, diário e apresentação |
| `assets/images/`                                 | Cinco imagens extraídas do HTML original, sem alterar os bytes        |
| `src/app.js`                                     | Inicialização, estado da sessão, interface do jogo e coordenação      |
| `src/diary.js`                                   | Aulas, presenças, TPC, notas, rascunhos e relatórios                  |
| `src/model.js`                                   | Validação e normalização dos dados; compatibilidade de versões        |
| `src/backup.js`                                  | Importação, exportação e verificação de integridade                   |
| `src/storage.js`                                 | Gravação local e deteção de conflitos entre janelas                   |
| `src/points.js`                                  | Condições para anular pontos em segurança                             |
| `src/avatars.js`, `src/audio.js`                 | Personagens e sons sintetizados                                       |
| `src/presentation.js`, `src/presentation-dom.js` | Janela pública e atualização do DOM                                   |
| `src/utils.js`                                   | Datas, identificadores, cópias e validações elementares               |
| `tests/`                                         | Testes de dados, persistência e fluxos integrados                     |
| `tools/`                                         | Servidor local e preparação dos ficheiros públicos                    |

Leia [a arquitetura](docs/ARQUITETURA.md) antes de alterar fluxos com estado e [a revisão técnica](docs/REVISAO.md) para conhecer os limites atuais.

## Qualidade

```sh
npm run format     # formatar HTML, CSS, JS e documentação
npm run check      # formatação + ESLint + testes
npm run build      # preparar apenas ficheiros públicos em dist/
```

As versões das ferramentas ficam registadas em `package-lock.json`. A integração contínua executa as verificações em pushes e pull requests. Os testes usam dados fictícios. Nunca acrescente backups reais como fixtures.

## Publicação no GitHub Pages

1. Enviar estas alterações para o repositório após revisão.
2. Em **Settings → Pages → Build and deployment → Source**, escolher **GitHub Actions**.
3. Em **Actions → Publicar no GitHub Pages**, escolher **Run workflow** na branch aprovada.
4. O workflow verifica o código, cria `dist/` e publica esse diretório. O endereço aparece no resultado do deployment.

A publicação é manual: o workflow de verificação não publica. Os caminhos relativos funcionam sob `/classroom-quest/`. `dist/` contém apenas HTML, módulos, estilos e imagens; não inclui dependências de desenvolvimento, testes ou backups.

Referência: [configurar a publicação no GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Dados e migração

Na tela inicial, indique e guarde o seu nome e personagem antes de entrar numa turma. Essa identificação fica guardada no navegador e aparece no jogo, apresentação e novas aulas do diário. Para a alterar, volte à tela inicial; o jogo não tem troca de professor. Os registos de aulas anteriores mantêm o nome registado na altura.

Os antigos perfis de demonstração deixam de preencher automaticamente o nome. Perfis importados e registos existentes são preservados nos backups.

Antes de mudar do HTML antigo para localhost ou GitHub Pages, exporte um **backup completo** na aplicação antiga e importe-o no novo endereço. O armazenamento pertence à origem e ao perfil do navegador; os dados não acompanham automaticamente a mudança de endereço ou computador.

São aceites saves de turma nas versões 1–6 e workspaces/backups nas versões 8–10. A chave `tic-quest.workspace.v8` foi mantida para compatibilidade na mesma origem. Importar como cópias preserva as turmas atuais; substituir exige a confirmação já existente na interface e inicia um backup preventivo.

Os backups completos e relatórios de dia completo contêm notas privadas. Não os coloque no repositório. O `.gitignore` cobre os nomes de exportação habituais, mas não identifica todos os ficheiros pessoais renomeados.

Não existe autenticação nem cifragem dos dados locais. Perfis de professor são preferências de utilização, não contas isoladas. Consulte [segurança e privacidade](SECURITY.md).

## Licença

Este projeto utiliza uma [licença própria de uso pessoal e estudo não comercial](LICENSE).

- Permitido: utilizar, estudar, modificar e partilhar gratuitamente para uso pessoal e estudo não comerciais, cumprindo a licença.
- Proibido: vender, revender, cobrar acesso, oferecer como serviço pago ou incorporar o projeto em produtos e serviços comerciais, incluindo versões modificadas.
- As cópias devem conservar a autoria e a licença; a distribuição de modificações deve incluir o respetivo código fonte sob as mesmas condições.

É código disponibilizado para consulta e estudo com restrições de utilização; não é software livre/open source. Dependências e materiais de terceiros mantêm as suas próprias licenças. A origem/licença das imagens herdadas deve ser confirmada pelo autor antes da distribuição pública.

A mudança não revoga permissões validamente concedidas a versões anteriormente distribuídas sob MIT. O texto é uma licença personalizada; uma revisão jurídica é recomendada antes de o utilizar como instrumento de proteção comercial.
