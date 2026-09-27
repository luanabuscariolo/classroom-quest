# Arquitetura e manutenção

Resumo técnico das regras do código. Para uma explicação completa, com diagramas, tabela de versões e receitas, veja o [guia do projeto](GUIA.md).

## Arranque e dependências

`index.html` carrega `src/app.js` com `type="module"`. O navegador resolve os imports antes de inicializar a interface. Não existem variáveis de aplicação publicadas em `window` nem imports circulares.

Os módulos dividem-se em três camadas:

| Camada                | Módulos                                                                                                                                      | Regra                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Dados (sem DOM)       | `model.js`, `backup.js`, `storage.js`, `persistence.js`, `points.js`, `diary-data.js`, `utils.js`                                            | Testáveis isoladamente; recebem e devolvem dados normalizados |
| Controladores de ecrã | `teacher.js`, `hub.js`, `roster.js`, `teams.js`, `activities.js`, `attention.js`, `raffle.js`, `backup-ui.js`, `diary.js`, `presentation.js` | Cada um liga os seus botões e guarda o seu estado temporário  |
| Apoio à interface     | `dom.js`, `avatars.js`, `audio.js`, `presentation-dom.js`                                                                                    | Funções pequenas partilhadas                                  |

`app.js` é o ponto de entrada. Mantém a turma aberta e o tabuleiro de jogo (cartões, classificação, aluno selecionado, pontos e vidas), abre e fecha overlays e cria os controladores por ordem de dependência. No fim, `persistence.load()` lê os dados e `showHub()` mostra as turmas.

Cada controlador segue o mesmo padrão: `createX(app)` recebe funções explícitas, liga os eventos dos seus elementos e devolve só o que os outros precisam (por exemplo, `raffle.cancel()` ou `activities.pushHistory()`). Valores que são substituídos durante a execução (a turma aberta, o workspace depois de um restauro, os cartões) são lidos por getters do objeto `live` em `app.js`, nunca guardados em cópias.

Funções que recebem dados externos devolvem estruturas normalizadas: nunca se copia cegamente um objeto importado para o estado.

## Estado persistente

Um workspace contém professores, turmas, atividades frequentes, revisão e metadados do último backup. Cada turma contém 30 posições de aluno, vidas, equipas, histórico e diário. Uma posição vazia continua a existir para preservar referências antigas.

`persistence.js` é o dono do workspace. `dirty()` incrementa a revisão e chama `persist()`. `writeWorkspace()` compara o conteúdo local com o último snapshot lido antes de gravar. Alterações e eliminações noutra janela suspendem a gravação, preservando o estado em memória para exportação. Não se trata de uma transação entre processos: use uma janela de gestão e a apresentação associada, não duas sessões de edição concorrentes.

### Versões e compatibilidade

O formato atual é a versão 13 (`VERSION` em `model.js`). São aceites saves de turma nas versões 1–6 e workspaces/backups nas versões 8–13; `model.js` converte-os sempre para o formato atual. A chave `tic-quest.workspace.v8` foi mantida para que os dados já gravados na mesma origem continuem a ser lidos. Versões antigas da aplicação não abrem backups de versões mais novas. Importar como cópias preserva as turmas atuais; substituir pede confirmação e descarrega antes um backup preventivo.

Os antigos perfis de demonstração (IDs `master-*`) continuam nos backups, mas não preenchem o nome do professor.

### Identidade dos alunos (versão 11)

Cada turma tem 30 posições fixas. Cada aluno com nome tem também um `id` que não muda quando o nome é corrigido (`students.js`). Lançamentos do histórico, linhas de presença e notas guardam `{ slot, studentId, name }`; o nome fica como registo do momento.

- Escrever um nome numa posição vazia cria um aluno novo (novo `id`).
- Mudar um nome existente é uma correção: pontos, histórico, desfazer e TPC continuam ligados.
- "Remover aluno da turma" (ou apagar o nome) liberta a posição: `id` nulo, pontos a zero, sai das equipas. Os registos antigos mantêm-se, mas deixam de poder ser desfeitos ou premiados.
- `sameStudent()` decide se uma posição ainda tem o aluno de um registo. Registos anteriores à versão 11 foram ligados pelo nome na migração; os que já não coincidiam ficam com `studentId: null` e continuam a comparar o nome.

A cópia `.previous` serve para recuperação: se a gravação principal não puder ser lida, abre-se a cópia anterior e a gravação automática fica suspensa. Não substitui um backup descarregado. Uma quota excedida ou armazenamento bloqueado deixa um aviso visível (`backup-ui.js`).

## Registo (diário da turma)

O dia da aula (`sessionDay` em `app.js`) escolhe-se no ecrã das turmas: **▶ Aula de hoje** ou **📅 Aula passada**. Aplica-se a tudo o que se faz com a turma aberta: o Registo escreve na aula desse dia e os pontos ficam datados nesse dia (`stampOn`). Uma aula passada abre só de leitura (`readOnly`): os controlos que alteram dados (`EDIT_CONTROLS`, pontos, vidas, Registo) ficam desativados até "✎ Editar esta aula"; "✓ Terminar edição" ou sair da turma voltam a bloquear. `addPoints` e `changeLife` também recusam alterações em só leitura.

`diary.js` controla o ecrã ✎ Registo e usa a grelha de alunos de `lesson-log.js`. Não há rascunho nem botão "Guardar": cada toque grava logo e o texto grava 0,4 s depois da última tecla, por campo (`later`/`flush`). Mudar de separador, fechar ou esconder a página grava o que estiver pendente. Ao abrir, guarda-se uma cópia (alunos, histórico e diário da turma); **Cancelar** (ou Esc, via `beforeClose`) repõe essa cópia depois de confirmar, e **Salvar e sair** só fecha. Assim nada se perde se o aparelho desligar, e cancelar continua a desfazer tudo. O backup com um clique (`backupNow`) e a saída da turma estão no ecrã do jogo.

Numa aula há uma linha por aluno com presença, comportamento, participação, material, TPC e observação. O ecrã tem um separador por tipo de informação (Sumário, Presença, Comportamento, Participação, Material, TPC, Observação) e nenhuma informação aparece em dois sítios. As opções de cada marcação e os seus emojis estão em `MARKS` (`lesson-log.js`), usados também pela tabela de desempenho. A "nota geral sobre a turma" é a nota do dia sem aluno (`slot: null`) e vive no separador Observação. Notas por aluno de versões anteriores continuam no histórico.

**TPC:** a entrega de uma TPC é marcada nas linhas da aula em que a TPC foi dada (não na aula em que se verifica). No separador TPC escolhe-se a TPC a verificar (por defeito, a que tem entrega nesse dia); as marcações e o prémio de pontos aplicam-se a essa aula.

As regras (numeração de aulas, quem pode receber pontos de TPC, ligação `awardId`) e os textos dos relatórios estão em `diary-data.js`, testados em `tests/diary.test.js`. Premiar TPC altera os pontos e grava o `awardId`; a validação exige que a ligação ao histórico exista.

## Notas do período (versão 12)

Os registos guardam factos (presença, comportamento, participação, material, notas 0–100 dos trabalhos); a nota nunca é gravada. `grading.js` calcula-a a partir desses factos e das regras em `workspace.grading`, por isso as regras podem mudar a qualquer momento. o ✎ Registo grava cada marcação logo, diretamente no diário da turma; `grades-ui.js` (◆ Avaliação) abre a janela e escolhe o separador; cada separador tem o seu módulo: `performance.js` (Desempenho), `period-grades-ui.js` (Acompanhamento e Notas do período), `assessments-ui.js` (Trabalhos), `rules-ui.js` (Regras) e `grade-explain.js` ("Como foi calculada"). Nenhum destes ecrãs é copiado para a apresentação.

Desde a versão 13, cada trabalho tem ficha própria: data, descrição e, se o professor quiser, critérios com pesos que somam 100. Com critérios, guarda-se a nota de cada critério (`marks`) e a nota do trabalho é calculada por `assessmentScore` (Σ nota × peso ÷ 100, só quando todos os critérios têm nota e os pesos somam 100); `scores` fica vazio, para a nota existir num só sítio.

## Apresentação

A apresentação recebe cópias do DOM do jogo e de overlays públicos permitidos. Nunca recebe o objeto workspace, diário ou formulários privados. Remove formulários e atributos de eventos; encaminha apenas ações numa lista explícita. Os estilos são carregados por URLs absolutas resolvidas a partir dos recursos locais, incluindo numa subpasta.

O DOM é atualizado de forma incremental para não reiniciar todas as animações. A roleta (`raffle.js`) usa um temporizador da apresentação quando ela existe, para continuar a girar com a janela principal minimizada, e regressa à janela principal ao fechá-la.

## Modo sala (tablet + PC)

`tools/room.js` ("TIC Quest · Sala") corre no PC do professor. Serve os mesmos ficheiros públicos (`tools/static.js`, partilhado com `serve.js`) e uma API mínima: `POST /api/login` (código de 6 dígitos → token), `GET /api/workspace?since=N` (204 se nada mudou) e `PUT /api/workspace` com a versão de base (409 se outro aparelho gravou primeiro). O `index.html` servido pela sala leva `<meta name="tic-room">` e `connect-src 'self'`; publicado no GitHub Pages continua com `connect-src 'none'`.

Os dados ficam em `Documentos\TIC Quest\dados.json` (formato de workspace, importável como backup), escritos por ficheiro temporário + renomear; `copias/` guarda uma cópia no máximo a cada 10 minutos (as 100 mais recentes e a primeira de cada dia). Um `dados.json` danificado nunca é substituído: a sala não abre e indica as cópias. O código e os aparelhos já ligados ficam em `sala.json`. O próprio PC (localhost) não precisa do código.

No navegador, `src/room.js` troca o armazenamento de `persistence.js`: em vez de `localStorage`, um objeto com a mesma interface que guarda o workspace em memória e o envia ao PC; as outras chaves (tema, token) ficam no navegador. De 1,5 em 1,5 segundos pergunta ao PC se há mudanças; quando há, `reloadWorkspace()` em `app.js` volta a desenhar o ecrã (espera se uma janela como o Registo estiver aberta). O PC segue a turma aberta no tablet; abrir outra turma não é enviado como alteração. Sem rede, as alterações ficam guardadas no aparelho (`tic-quest.room.pending`) e são enviadas quando a ligação volta; em conflito, vencem os dados do PC e o que não foi enviado é descarregado como ficheiro. A janela de apresentação é a de sempre: copia o ecrã do PC, que se atualiza sozinho.

## App instalável e offline

`manifest.webmanifest` e `sw.js` (na raiz, para controlar todo o site) permitem instalar a aplicação e usá-la sem internet. O service worker usa primeiro a rede e guarda uma cópia; sem rede, serve a cópia. Ao acrescentar um ficheiro público, acrescente-o a `FILES` em `sw.js` (o teste `site.test.js` falha se faltar). `app.js` também pede ao navegador armazenamento persistente, para reduzir o risco de os dados serem apagados.

## Temas

`theme.js` recolore o CSS em tempo de execução: guarda as declarações originais de cada folha de estilo e, para cada tema, transforma cada cor por regras de teoria das cores (propriedades de texto e de superfície tratadas à parte; variáveis `--gold`… substituídas pelo valor antes de transformar). Por isso o CSS continua escrito só para o tema roxo e uma cor nova funciona em todos os temas. O tema é uma preferência do aparelho (`localStorage`, chave `tic-quest.theme`), não entra nos backups, e aplica-se também à janela de apresentação.

## Estilos

As imagens estão em WebP. A ordem dos links é intencional: `styles.css`, `feedback.css`, `game.css`, `workspace.css`, `diary.css`, `grades.css`. A divisão preserva a cascata do protótipo. `presentation.css` só é acrescentado à segunda janela. Ainda existem seletores sobrepostos; consolidá-los exige comparação visual.

## Acrescentar funcionalidades

1. Regras sobre dados vão para um módulo independente da interface; inclua validação e limites.
2. Fluxos com estado próprio ganham um controlador `createX(app)` num ficheiro próprio, criado em `app.js` com dependências explícitas. Só acrescente código ao `app.js` se for do tabuleiro de jogo.
3. Cada elemento tem um único dono: não reatribua o `onclick` de um botão noutro módulo.
4. Acrescente controlos no HTML e estilos na área correspondente. Use `textContent` para nomes/notas importados.
5. Teste persistência, backup e restauro se o formato mudar. Não altere a chave ou versão sem migração explícita.
6. Acrescente um teste em `tests/`; os fluxos de interface usam jsdom (ver `tests/game.test.js`).
7. Execute `npm run check` e verifique teclado, ecrã pequeno e apresentação antes de publicar.
