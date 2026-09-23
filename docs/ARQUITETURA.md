# Arquitetura e manutenção

## Arranque e dependências

`index.html` carrega `src/app.js` com `type="module"`. O navegador resolve os imports antes de inicializar a interface. Não existem variáveis de aplicação publicadas em `window` nem imports circulares.

`app.js` mantém o workspace, a turma atual e o estado temporário do jogo. `createAudio`, `createDiary` e `createPresentation` têm estado privado. Diário e apresentação recebem funções explícitas e getters para ler a turma/workspace atuais. Os getters são necessários porque uma importação pode substituir o objeto inteiro.

`model.js`, `backup.js`, `storage.js` e `points.js` não dependem da interface e podem ser testados isoladamente. Funções que recebem dados externos devolvem estruturas normalizadas: nunca se copia cegamente um objeto importado para o estado.

## Estado persistente

Um workspace contém professores, turmas, atividades frequentes, revisão e metadados do último backup. Cada turma contém 30 posições de aluno, vidas, equipas, histórico e diário. Uma posição vazia continua a existir para preservar referências antigas.

`dirty()` incrementa a revisão e chama `persist()`. `writeWorkspace()` compara o conteúdo local com o último snapshot lido antes de gravar. Alterações e eliminações noutra janela suspendem a gravação, preservando o estado em memória para exportação. Não se trata de uma transação entre processos: use uma janela de gestão e a apresentação associada, não duas sessões de edição concorrentes.

A cópia `.previous` serve para recuperação, não substitui um backup descarregado. Uma quota excedida ou armazenamento bloqueado deixa um aviso visível.

## Rascunho do diário

Ao abrir uma turma, `prepareDayDraft()` copia o diário persistido antes de renderizar. Edições mudam o rascunho. `saveDayEdits()` confirma o rascunho no workspace e tenta a gravação local. Navegar ou fechar com alterações solicita guardar; cancelar conserva a edição.

Premiar TPC envolve o histórico/pontos da turma e o `awardId` no diário. O controlador guarda antes e depois dessa operação. Ao mudar este fluxo, teste também backup e reabertura: a validação exige que a ligação ao histórico exista.

## Apresentação

A apresentação recebe cópias do DOM do jogo e de overlays públicos permitidos. Nunca recebe o objeto workspace, diário ou formulários privados. Remove formulários e atributos de eventos; encaminha apenas ações numa lista explícita. Os estilos são carregados por URLs absolutas resolvidas a partir dos recursos locais, incluindo numa subpasta.

O DOM é atualizado de forma incremental para não reiniciar todas as animações. A roleta usa um temporizador da apresentação quando ela existe e regressa à janela principal ao fechá-la.

## Estilos

A ordem dos links é intencional: `styles.css`, `feedback.css`, `game.css`, `workspace.css`, `diary.css`. A divisão preserva a cascata do protótipo. `presentation.css` só é acrescentado à segunda janela. Ainda existem seletores sobrepostos; consolidá-los exige comparação visual.

## Acrescentar funcionalidades

1. Regras sobre dados vão para um módulo independente da interface; inclua validação e limites.
2. Fluxos com estado próprio devem expor um controlador com dependências explícitas.
3. Acrescente controlos no HTML e estilos na área correspondente. Use `textContent` para nomes/notas importados.
4. Altere a implementação responsável, em vez de acrescentar sucessivas reatribuições de funções.
5. Teste persistência, backup e restauro se o formato mudar. Não altere a chave ou versão sem migração explícita.
6. Execute `npm run check` e verifique teclado, ecrã pequeno e apresentação antes de publicar.
