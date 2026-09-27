# Contexto para o curso de estudo do TIC Quest

Este ficheiro serve para passar a outra conversa (outro chat com IA) todo o contexto necessário para criar **um curso guiado, com plano de estudo diário**, até a autora ter percorrido e compreendido o projeto inteiro. A conversa de desenvolvimento (onde se pedem funcionalidades) fica separada da conversa de estudo.

---

## 1. Pedido para colar no novo chat

> Quero estudar a fundo o projeto TIC Quest, que está nesta pasta (repositório `classroom-quest`). Ele foi construído em grande parte com ajuda de IA e cresceu depressa; agora preciso de o compreender por completo: o que foi feito, como foi decidido, como foi programado e organizado, e como faria algo assim do zero.
>
> Lê primeiro `docs/CONTEXTO-PARA-ESTUDO.md` (este ficheiro) e, a seguir, `README.md`, `docs/DECISOES.md`, `docs/GUIA.md` e `docs/ARQUITETURA.md`.
>
> Depois, cria para mim **um curso guiado com um plano de estudo diário**, do primeiro dia até ao momento em que tenha passado por todo o projeto. Antes de fechar o plano, pergunta-me quanto tempo tenho por dia e em que dias, e confirma o meu nível. Cada dia deve ter: objetivo, o que ler (ficheiros e funções concretas), explicação dos conceitos novos, um exercício prático feito por mim, como verificar se ficou certo e perguntas para eu responder sem consultar o código. Inclui uma trilha paralela para **reconstruir uma versão pequena do zero**.
>
> Regras: responde em português do Brasil; não alteres o projeto a não ser nos exercícios, numa branch de estudo; eu faço os commits; não uses os meus dados reais.

---

## 2. Quem vai estudar

- Professora de TIC em Portugal, no primeiro ano de ensino e de lançamento de notas. Criou o projeto para usar nas suas aulas.
- **Nível (a confirmar no início):** entende HTML e CSS e conhece um pouco de JavaScript. Um plano anterior partia de cerca de **10 horas por semana**; confirmar a disponibilidade diária real.
- Usa **Git e GitHub** (faz os próprios commits e pushes; publica pelo GitHub Actions), Windows no computador e um tablet Android. Tem o Node.js instalado (usa `Sala.bat`).
- Aprende melhor **fazendo**: ler sem mexer não fixa.
- **Preferências que devem valer também no curso:**
  - conversa em **português do Brasil**; o texto do repositório (interface, documentação) está em **português de Portugal**;
  - ela própria faz os commits: o curso dá os comandos, não os executa;
  - explicações diretas, com exemplos do próprio projeto;
  - uma informação num só sítio (não repetir o mesmo conteúdo em vários dias/documentos sem necessidade).

---

## 3. O que é o projeto

**TIC Quest** é uma aplicação web para a sala de aula, com duas metades:

1. **Jogo da turma** (no projetor): alunos com avatares, pontos (+1, +2, +5, +10), fases, vidas da turma, equipas, roleta de sorteio, contagem "Atenção, turma!", sons e animações.
2. **Diário e avaliação do professor** (privado): registo de cada aula (sumário, presenças, comportamento, participação, material, TPC, observações), trabalhos com critérios de avaliação, nota do período calculada a partir dos registos, modo de lançamento no Inovar (plataforma da escola) e exportação para Excel.

Outras peças:

- **Janela de apresentação:** segunda janela para o projetor que mostra só o jogo, nunca os dados privados.
- **Temas:** Roxo, Verde, Preto e Claro.
- **Instalável e offline** (PWA).
- **Backups** com verificação de integridade.
- **Modo sala (opcional):** um pequeno servidor em Node no computador do professor guarda os dados num ficheiro; outros aparelhos na mesma rede (ex.: tablet) entram com um código e comandam a aula, e o projetor acompanha em tempo real (incluindo a roleta e o "Atenção, turma!").

**Tecnologia:** HTML, CSS e JavaScript simples com módulos do navegador; **sem framework e sem compilação**. Node.js só para o servidor local, o modo sala, as ferramentas e os testes. Publicado no GitHub Pages. Dependências só de desenvolvimento: ESLint, Prettier, jsdom (e acorn).

**Comandos:**

| Comando                        | Para quê                                                      |
| ------------------------------ | ------------------------------------------------------------- |
| `npm install`                  | Instalar as ferramentas (uma vez)                             |
| `npm run dev`                  | Abrir a aplicação em `http://127.0.0.1:4173/classroom-quest/` |
| `npm run sala` (ou `Sala.bat`) | Modo sala (dados em `Documentos\TIC Quest`)                   |
| `npm run demo`                 | Criar `TIC_DEMO_5X.json`: turma fictícia 5ºX para importar    |
| `npm test` / `npm run check`   | Testes / formatação + lint + testes                           |

---

## 4. Como o projeto evoluiu

| Commit    | O que aconteceu                                                                                                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `866e104` | Repositório criado.                                                                                                                                                                                                      |
| `d4fd294` | Um único HTML de ~11 MB (imagens e código embutidos) é dividido em HTML, módulos JS, CSS e imagens; testes, lint, CI e publicação.                                                                                       |
| `f87b2e9` | `app.js` (~2 200 linhas) dividido em módulos; imagens em WebP; mais testes.                                                                                                                                              |
| `7df3d1d` | Versão 11 dos dados: `id` por aluno, remover aluno, avatar sorteado pelo nome.                                                                                                                                           |
| `40a26b0` | Guia completo do projeto (`docs/GUIA.md`).                                                                                                                                                                               |
| `5440911` | Versão 13: Registo das aulas, avaliação e nota do período, critérios por trabalho, "Como foi calculada", turma demo, aula passada só de leitura, temas, app instalável.                                                  |
| `77445f6` | A janela Avaliação dividida num módulo por separador.                                                                                                                                                                    |
| `449d998` | Modo sala: servidor local, dados em ficheiro, tablet ligado pela rede.                                                                                                                                                   |
| `7b84bbf` | Modo sala: roleta e "Atenção, turma!" ao vivo no projetor.                                                                                                                                                               |
| `34a689b` | README e guia: modo sala descrito de forma genérica.                                                                                                                                                                     |
| `027b852` | `docs/DECISOES.md`: porque cada coisa foi feita assim. (Este commit também continha um `docs/PLANO-DE-ESTUDO.md` anterior, depois apagado da pasta; pode ser consultado com `git show 027b852:docs/PLANO-DE-ESTUDO.md`.) |

Como foi desenvolvido: por conversa com uma IA. A autora descrevia o que precisava nas aulas; a IA propunha, programava, testava (testes automáticos e navegador) e documentava; a autora testava, corrigia o rumo e fazia os commits. Várias regras do projeto nasceram dessas correções (ver secção 7).

---

## 5. Mapa do código (tamanho aproximado)

**Entrada e ecrã do jogo:** `index.html` (~1 100 linhas: toda a estrutura dos ecrãs), `src/app.js` (~980: ponto de entrada, cartões dos alunos, pontos, vidas, janelas; cria e liga os outros módulos).

**Dados e gravação (sem ecrã):**

| Ficheiro                     |   Linhas | Papel                                                                     |
| ---------------------------- | -------: | ------------------------------------------------------------------------- |
| `src/model.js`               |     ~410 | Formato dos dados, validação, conversão de versões antigas (`VERSION` 13) |
| `src/storage.js`             |      ~20 | Gravar no navegador detetando conflitos                                   |
| `src/persistence.js`         |     ~105 | Dono dos dados: carregar, gravar, recuperar, restaurar                    |
| `src/backup.js`              |      ~70 | Pacote de backup com verificação de integridade                           |
| `src/students.js`            |      ~60 | Aluno vazio, nome, `id`, remover                                          |
| `src/utils.js`, `src/dom.js` | ~65, ~55 | Datas, identificadores; criar elementos, descarregar ficheiros            |

**Regras de negócio (sem ecrã):** `src/grading.js` (~570: regras e cálculo da nota, critérios, explicação, CSV), `src/diary-data.js` (~285: aulas, TPC, relatórios).

**Ecrãs (um módulo cada):**

| Ficheiro                                                          | Ecrã                                                |
| ----------------------------------------------------------------- | --------------------------------------------------- |
| `src/hub.js`                                                      | Lista de turmas, saudação, aula de hoje/passada     |
| `src/teacher.js`                                                  | Perfil do professor                                 |
| `src/roster.js`, `src/teams.js`                                   | Nomes e avatares; equipas                           |
| `src/activities.js`, `src/points.js`                              | Dar pontos a vários alunos; histórico               |
| `src/raffle.js`, `src/attention.js`                               | Roleta; "Atenção, turma!"                           |
| `src/diary.js`, `src/lesson-log.js`                               | ✎ Registo da aula (~660 + ~250)                     |
| `src/grades-ui.js`                                                | ◆ Avaliação: período e separadores                  |
| `src/performance.js`                                              | Separador Desempenho                                |
| `src/period-grades-ui.js`                                         | Acompanhamento e Notas do período (Inovar, CSV)     |
| `src/assessments-ui.js`                                           | Trabalhos e ficha com critérios (~450)              |
| `src/rules-ui.js`, `src/grade-explain.js`, `src/grades-format.js` | Regras; "Como foi calculada"; formato dos números   |
| `src/backup-ui.js`                                                | Backup, importação, avisos                          |
| `src/presentation.js`, `src/presentation-dom.js`                  | Janela do projetor                                  |
| `src/avatars.js`, `src/audio.js`, `src/theme.js`                  | Avatares; sons (Web Audio); temas                   |
| `src/room.js`                                                     | Modo sala no navegador: ligar, sincronizar, eventos |

**Servidor e ferramentas (Node):** `tools/serve.js` (servidor local), `tools/static.js` (ficheiros públicos), `tools/room.js` (~415: modo sala), `tools/build.js`, `tools/demo.js` + `tools/demo-data.js` (turma 5ºX com 30 cenários).

**Estilos:** `assets/css/` (`styles`, `game`, `feedback`, `workspace`, `diary`, `grades`, `presentation`), escritos só para o tema roxo; os outros temas são calculados.

**Outros:** `sw.js` (offline), `manifest.webmanifest`, `Sala.bat`, `.github/workflows/` (verificação e publicação).

**Testes (`tests/`, ~70 testes):** `model`, `students`, `storage`, `persistence`, `grading`, `demo` (notas dos 30 alunos contra um cálculo independente), `diary`, `theme`, `teacher`, `site`, `app` e `game` (ecrãs completos com jsdom), `room` (servidor real + aplicação no modo sala).

---

## 6. Conceitos que o projeto usa (o que há para aprender)

Organizados do mais básico ao mais avançado, com onde aparecem. O curso deve cobrir todos.

| Conceito                                                                 | Onde ver no projeto                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| HTML semântico, atributos `id`, `hidden`, `aria-*`                       | `index.html`                                                  |
| CSS: seletores, flex, grid, variáveis, media queries, animações          | `assets/css/`                                                 |
| JavaScript: variáveis, funções, objetos, arrays, `map/filter/reduce`     | todo o `src/`                                                 |
| Módulos ES (`import`/`export`)                                           | início de cada ficheiro em `src/`                             |
| DOM: procurar, criar e alterar elementos; eventos (`onclick`)            | `dom.js`, `app.js` (`buildCards`, `updateCard`)               |
| Estado da aplicação e redesenhar o ecrã                                  | `app.js` (`state`, `syncAll`)                                 |
| Funções-fábrica, _closures_, _getters_, injeção de dependências          | `createX(app)` em todos os módulos; objeto `live` em `app.js` |
| JSON, `localStorage`                                                     | `storage.js`, `persistence.js`                                |
| Validação de dados, versões e migrações                                  | `model.js`                                                    |
| Referências vs. cópias; identidade (`id`)                                | `students.js`, `utils.js` (`copy`)                            |
| Datas no formato ISO                                                     | `utils.js`, `diary-data.js`                                   |
| Médias ponderadas; separar cálculo de ecrã                               | `grading.js`                                                  |
| Temporizadores, animação, `<canvas>`                                     | `raffle.js`, `attention.js`                                   |
| Web Audio                                                                | `audio.js`                                                    |
| Segunda janela (`window.open`), segurança de conteúdo (CSP)              | `presentation.js`, `<meta http-equiv>` em `index.html`        |
| Cores (RGB/HSL) e CSSOM                                                  | `theme.js`                                                    |
| PWA: manifest, _service worker_, cache                                   | `manifest.webmanifest`, `sw.js`                               |
| Node.js: servidor HTTP, ficheiros, caminhos                              | `tools/serve.js`, `tools/static.js`, `tools/room.js`          |
| HTTP e API: métodos, estados (200, 204, 401, 409), JSON, `fetch`         | `tools/room.js`, `src/room.js`                                |
| Sincronização: versões, conflitos, _polling_, _long polling_             | `src/room.js`, `tools/room.js`                                |
| Escrita segura em disco (temporário + renomear), cópias                  | `tools/room.js`                                               |
| Testes automáticos (`node --test`, `assert`), navegador simulado (jsdom) | `tests/`                                                      |
| ESLint, Prettier, `npm` scripts                                          | `eslint.config.js`, `package.json`                            |
| Git, GitHub Actions, GitHub Pages                                        | `.github/workflows/`                                          |
| Depurar: consola, pontos de paragem (DevTools)                           | no navegador, com qualquer ecrã                               |

---

## 7. Regras e decisões que o curso deve explicar

As decisões estão em `docs/DECISOES.md` (3 princípios + 20 decisões, cada uma com problema, opções, escolha e custo). As mais importantes para o estudo:

- **Guardar factos, calcular a nota** (a nota do período nunca é guardada).
- **Validar tudo o que entra** (`validateWorkspace`) e versionar o formato.
- **Nunca escrever por cima de dados alheios** (deteção de conflitos, cópia anterior).
- **Um módulo por ecrã com dependências explícitas** (`createX(app)`).
- **A apresentação copia o ecrã, nunca os dados.**
- **Modo sala:** o armazenamento é trocável, por isso a aplicação passou a gravar no computador quase sem mudar o resto.

Princípios que vieram das correções da autora durante o desenvolvimento (bons exemplos de como requisitos reais moldam o código):

- **Cada informação num só lugar** (ela considerou isto importante).
- **Nunca destacar um aluno:** avatares sorteados, qualquer aluno pode ser robô; nomes desconhecidos não recebem um avatar "especial".
- **O caso comum já feito:** todos começam presentes e no máximo; um toque escolhe a opção.
- Exemplos de correções: o botão "Nova aula" saiu da apresentação; Backup/Sair passaram para o ecrã da turma; "Duplicar turma" foi substituído por "Apagar" (com cópia descarregada antes); uma nota final de 5,00 sem trabalhos era enganadora e passou a "—".

---

## 8. Sugestão de percurso (o novo chat pode adaptar)

Percorrer as camadas pela ordem em que dependem umas das outras, sempre a partir de ações reais da aplicação:

1. **Mapa e arranque:** usar a aplicação com a turma demo; `index.html` → `app.js`; o que corre no navegador, no Node e no GitHub.
2. **JavaScript com os dados reais do projeto:** objetos de aluno e turma, arrays, funções (`students.js`, `utils.js`).
3. **Um clique do princípio ao fim:** "+1 ponto" → `addPoints` → histórico → gravação → ecrã.
4. **Dados:** formato, validação, versões (`model.js`).
5. **Gravação e segurança:** `storage.js`, `persistence.js`, backups.
6. **Organização em módulos:** `createX(app)`, `live`, `withLive`, arranque em `app.js`.
7. **Registo das aulas:** `diary.js`, `lesson-log.js`, `diary-data.js`.
8. **Notas:** `grading.js` (calcular à mão e comparar com `tests/demo.test.js`), critérios, ecrãs da Avaliação.
9. **Projetor e extras:** apresentação, roleta, atenção, avatares, áudio, temas.
10. **Rede e modo sala:** HTTP, `tools/room.js`, `src/room.js`, conflitos, eventos ao vivo.
11. **Qualidade e publicação:** testes, lint, CI, service worker, GitHub Pages.
12. **Autonomia:** uma alteração pequena feita sozinha (com revisão) e a reconstrução do zero concluída.

**Trilha paralela "do zero":** numa pasta separada, construir aos poucos um mini TIC Quest (lista de alunos, pontos, gravar no navegador, validar ao carregar, um módulo por ecrã, um teste), para reconhecer depois as mesmas peças no projeto real.

**Ideias de exercícios no projeto real** (numa branch `estudo`): acrescentar um botão de pontos; uma frase do dia nova (`hub.js`); mudar o valor de uma marcação e ver a nota mudar; um campo novo no aluno seguindo a receita do guia (validação + versão + teste); um teste novo em `grading.test.js`; um novo tipo de evento ao vivo.

---

## 9. Cuidados durante o estudo

- **Nunca usar os dados reais** das turmas: usar a turma fictícia (`npm run demo` e importar `TIC_DEMO_5X.json`) e, no modo sala, uma pasta de teste (`node tools/room.js --dados <pasta-de-teste> --porta 4181`).
- Os dados reais do modo sala estão em `Documentos\TIC Quest` (e os backups em ficheiros `TIC_*.json`, que o `.gitignore` já exclui): não mexer.
- Fazer os exercícios numa **branch** (`git switch -c estudo`) e só levar para a `main` o que for mesmo para ficar.
- Correr `npm run check` depois de mexer: se passar, nada ficou partido.
- Pedidos de funcionalidades novas vão para a conversa de desenvolvimento, não para a de estudo.

---

## 10. Estado atual e o que está pendente (para não confundir com o estudo)

- Em testes reais nas aulas (1.º período de 2026/27).
- Ideias adiadas no desenvolvimento: espelhar no projetor o aluno selecionado no tablet; lembrete de backup quando passa uma semana sem backup; possível mudança do nome da aplicação (sugestões: "Turma em Jogo", "Caderno de Turma", "Missão Turma"); versão genérica/comercial no futuro.
