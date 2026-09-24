# Arquitetura e manutenção

## Arranque e dependências

`index.html` carrega `src/app.js` com `type="module"`. O navegador resolve os imports antes de inicializar a interface. Não existem variáveis de aplicação publicadas em `window` nem imports circulares.

Os módulos dividem-se em três camadas:

| Camada                | Módulos                                                                                                                                      | Regra                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Dados (sem DOM)       | `model.js`, `backup.js`, `storage.js`, `persistence.js`, `points.js`, `utils.js`                                                             | Testáveis isoladamente; recebem e devolvem dados normalizados |
| Controladores de ecrã | `teacher.js`, `hub.js`, `roster.js`, `teams.js`, `activities.js`, `attention.js`, `raffle.js`, `backup-ui.js`, `diary.js`, `presentation.js` | Cada um liga os seus botões e guarda o seu estado temporário  |
| Apoio à interface     | `dom.js`, `avatars.js`, `audio.js`, `presentation-dom.js`                                                                                    | Funções pequenas partilhadas                                  |

`app.js` é o ponto de entrada. Mantém a turma aberta e o tabuleiro de jogo (cartões, classificação, aluno selecionado, pontos e vidas), abre e fecha overlays e cria os controladores por ordem de dependência. No fim, `persistence.load()` lê os dados e `showHub()` mostra as turmas.

Cada controlador segue o mesmo padrão: `createX(app)` recebe funções explícitas, liga os eventos dos seus elementos e devolve só o que os outros precisam (por exemplo, `raffle.cancel()` ou `activities.pushHistory()`). Valores que são substituídos durante a execução (a turma aberta, o workspace depois de um restauro, os cartões) são lidos por getters do objeto `live` em `app.js`, nunca guardados em cópias.

Funções que recebem dados externos devolvem estruturas normalizadas: nunca se copia cegamente um objeto importado para o estado.

## Estado persistente

Um workspace contém professores, turmas, atividades frequentes, revisão e metadados do último backup. Cada turma contém 30 posições de aluno, vidas, equipas, histórico e diário. Uma posição vazia continua a existir para preservar referências antigas.

`persistence.js` é o dono do workspace. `dirty()` incrementa a revisão e chama `persist()`. `writeWorkspace()` compara o conteúdo local com o último snapshot lido antes de gravar. Alterações e eliminações noutra janela suspendem a gravação, preservando o estado em memória para exportação. Não se trata de uma transação entre processos: use uma janela de gestão e a apresentação associada, não duas sessões de edição concorrentes.

### Versões e compatibilidade

São aceites saves de turma nas versões 1–6 e workspaces/backups nas versões 8–10; `model.js` converte-os sempre para o formato atual. A chave `tic-quest.workspace.v8` foi mantida apesar da versão 10 para que os dados já gravados na mesma origem continuem a ser lidos. Importar como cópias preserva as turmas atuais; substituir pede confirmação e descarrega antes um backup preventivo.

Os antigos perfis de demonstração (IDs `master-*`) continuam nos backups, mas não preenchem o nome do professor.

A cópia `.previous` serve para recuperação: se a gravação principal não puder ser lida, abre-se a cópia anterior e a gravação automática fica suspensa. Não substitui um backup descarregado. Uma quota excedida ou armazenamento bloqueado deixa um aviso visível (`backup-ui.js`).

## Rascunho do diário

Ao abrir uma turma, `prepareDayDraft()` copia o diário persistido antes de renderizar. Edições mudam o rascunho. `saveDayEdits()` confirma o rascunho no workspace e tenta a gravação local. Navegar ou fechar com alterações solicita guardar; cancelar conserva a edição.

Premiar TPC envolve o histórico/pontos da turma e o `awardId` no diário. O controlador guarda antes e depois dessa operação. Ao mudar este fluxo, teste também backup e reabertura: a validação exige que a ligação ao histórico exista.

## Apresentação

A apresentação recebe cópias do DOM do jogo e de overlays públicos permitidos. Nunca recebe o objeto workspace, diário ou formulários privados. Remove formulários e atributos de eventos; encaminha apenas ações numa lista explícita. Os estilos são carregados por URLs absolutas resolvidas a partir dos recursos locais, incluindo numa subpasta.

O DOM é atualizado de forma incremental para não reiniciar todas as animações. A roleta (`raffle.js`) usa um temporizador da apresentação quando ela existe, para continuar a girar com a janela principal minimizada, e regressa à janela principal ao fechá-la.

## Estilos

As imagens estão em WebP. A ordem dos links é intencional: `styles.css`, `feedback.css`, `game.css`, `workspace.css`, `diary.css`. A divisão preserva a cascata do protótipo. `presentation.css` só é acrescentado à segunda janela. Ainda existem seletores sobrepostos; consolidá-los exige comparação visual.

## Acrescentar funcionalidades

1. Regras sobre dados vão para um módulo independente da interface; inclua validação e limites.
2. Fluxos com estado próprio ganham um controlador `createX(app)` num ficheiro próprio, criado em `app.js` com dependências explícitas. Só acrescente código ao `app.js` se for do tabuleiro de jogo.
3. Cada elemento tem um único dono: não reatribua o `onclick` de um botão noutro módulo.
4. Acrescente controlos no HTML e estilos na área correspondente. Use `textContent` para nomes/notas importados.
5. Teste persistência, backup e restauro se o formato mudar. Não altere a chave ou versão sem migração explícita.
6. Acrescente um teste em `tests/`; os fluxos de interface usam jsdom (ver `tests/game.test.js`).
7. Execute `npm run check` e verifique teclado, ecrã pequeno e apresentação antes de publicar.
