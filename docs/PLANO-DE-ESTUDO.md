# Plano de estudo do Classroom Quest

Referência: código no commit `7b84bbf`, de 27 de setembro de 2026.

## O objetivo

Conseguir explicar o projeto, localizar uma alteração, prever as suas consequências, implementá-la e verificar o resultado. Compreender tudo não exige memorizar todas as linhas: exige saber seguir uma ação, encontrar a regra responsável e justificar a solução.

Ponto de partida: já entende HTML/CSS, conhece um pouco de JavaScript e pode reservar **10 horas por semana**. A proposta inicial é de **12 semanas, cerca de 120 horas**. É uma distribuição de estudo, não uma promessa de domínio completo nesse prazo: fundamentos, avaliação e rede podem exigir semanas adicionais. Avance pelo resultado demonstrado, não apenas pelo calendário.

Ao terminar, deverá conseguir:

- Desenhar o caminho entre um clique, os dados, a gravação e o ecrã.
- Distinguir o que corre no navegador, no Node.js e no GitHub.
- Explicar as principais decisões e os seus custos.
- Corrigir um problema pequeno sem pedir uma implementação à IA.
- Construir uma versão pequena desta aplicação numa pasta vazia.
- Consultar documentação e depurar o que ainda não sabe.

## Calendário adaptado: 10 horas por semana

Distribua as dez horas por cinco blocos de duas horas, se isso couber na sua rotina. Em cada bloco, faça duas sessões de cerca de 50 minutos com pausas. Ao longo da semana, reserve aproximadamente três horas para leitura e conceitos, quatro para experiências e reconstrução, duas para testes/depuração e uma para revisão sem consultar o código.

| Semana | Foco e etapas                                                      | Resultado concreto                                                                |
| ------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 1      | Mapa do projeto e ligação HTML → JavaScript (1–2)                  | Explicar os três contextos de execução e localizar o código de três botões        |
| 2      | JavaScript, objetos, arrays, funções e identidade (3)              | Laboratório com três alunos; criar, corrigir e remover sem confundir identidades  |
| 3      | Clique, pontos, histórico e atualização (4)                        | Seguir uma atribuição com o depurador e reconstruir um contador com histórico     |
| 4      | Modelo e versões dos dados (5)                                     | Desenhar um workspace e justificar as validações de um aluno e de uma turma       |
| 5      | Gravação, conflitos e backups (6)                                  | Laboratório que guarda, recupera e rejeita um exemplo inválido                    |
| 6      | Controladores, getters e arranque (7)                              | Dividir o laboratório em módulos e demonstrar uma troca de turma                  |
| 7      | Registo de aulas, TPC e cancelamento (primeira parte de 8)         | Seguir um registo completo e explicar o que é reposto ao cancelar                 |
| 8      | Avaliação, critérios, períodos e explicação das notas (resto de 8) | Calcular um caso à mão e comparar com o código e os testes                        |
| 9      | Projetor, animações, avatares, áudio e temas (9)                   | Mapa desses módulos e exemplo próprio de temporizador cancelável                  |
| 10     | Cliente, servidor e sincronização (10)                             | Explicar uma gravação remota, uma perda de ligação e um evento ao vivo            |
| 11     | Offline, ferramentas, verificações e publicação (11)               | Explicar como preparar e verificar uma versão, incluindo os ficheiros que publica |
| 12     | Reconstrução e alteração autónoma (12)                             | Aplicação pequena escrita por si e uma alteração revista na cópia de estudo       |

A reconstrução começa na semana 2 e cresce em paralelo. A semana 12 serve para consolidar e demonstrar autonomia, não para escrever a aplicação inteira em dez horas. Se ainda não consegue explicar objetos e referências na semana 2, use mais tempo aí; isso torna o restante percurso mais produtivo.

### As primeiras dez horas

1. **2 h:** percorrer a aplicação com dados fictícios, desenhar o mapa e executar o servidor e os testes. Ler só as partes necessárias do README e do guia.
2. **2 h:** encontrar três botões no HTML e no JavaScript. Rever eventos e DOM através desses exemplos.
3. **2 h:** estudar `emptyStudent()` e `setStudentName()`. Fazer a primeira sessão guiada apresentada mais abaixo, dividindo-a se necessário.
4. **2 h:** criar num laboratório um objeto de aluno e um botão que lhe atribui pontos. Distinguir alterar o objeto de atualizar o texto no ecrã.
5. **2 h:** refazer o exemplo com o código fechado, explicar o percurso em voz alta e registar as dúvidas para a semana seguinte.

Não é necessário estudar as quase mil linhas de `app.js` nesta primeira semana.

## Como estudar em cada sessão

1. **5 min — recordar:** explique, sem abrir o código, o que aprendeu antes.
2. **10 min — observar:** escolha uma ação da aplicação e escreva o resultado esperado.
3. **15 min — investigar:** siga apenas o código necessário para essa ação.
4. **15 min — experimentar:** mude uma coisa no laboratório, preveja e execute.
5. **5 min — registar:** escreva o que aconteceu e uma dúvida concreta.

Antes de executar qualquer experiência, faça uma previsão. Depois compare-a com o resultado. Quando não coincidir, use um ponto de interrupção no depurador ou um registo temporário no console para observar os valores.

Use três espaços: o projeto de referência, uma cópia/branch de aprendizagem e um laboratório separado para reconstruir pequenos exemplos. Para a aplicação de estudo, use um perfil de navegador dedicado e dados fictícios. `localStorage` depende do endereço e do perfil do navegador, não da pasta do código: copiar a pasta e abrir no mesmo endereço não isola os dados.

Não é necessário alterar o projeto usado nas aulas para cumprir este plano. Não edite `node_modules/` nem `dist/`: são resultados de instalação e construção.

## Antes de começar: os três contextos de execução

| Contexto                            | O que corre                                                                              | Onde os dados principais ficam                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Site normal, incluindo GitHub Pages | HTML, CSS e módulos de `src/` no navegador                                               | `localStorage` desse navegador                           |
| Modo sala                           | Interface no navegador; `tools/room.js` no Node.js do PC; `src/room.js` comunica com ele | Ficheiro no PC, com gestão de sincronização nos clientes |
| Desenvolvimento e verificações      | Ferramentas de `tools/`, testes, ESLint e Prettier no Node.js; workflows no GitHub       | Ficheiros de desenvolvimento e dados fictícios de teste  |

**Atenção ao guia existente:** a introdução de `GUIA.md` ainda generaliza que não há servidor de dados e que Node.js é apenas uma ferramenta de desenvolvimento. Isso descreve o site normal, mas não o modo sala atual. Algumas contagens de linhas e diagramas também ficaram atrás do código. Use o guia como mapa e confirme o comportamento nas funções e nos testes. A versão 13 do formato de dados também não é a versão `1.0.0` de `package.json`: medem coisas diferentes.

## Etapa 1 — Orientação e ferramentas

**Pergunta:** que partes preciso de compreender para executar e inspecionar o projeto?

Leia o `README.md`, os comandos de `package.json` e as secções 1 e 2 de `docs/GUIA.md`. Localize `index.html`, `src/`, `assets/`, `tests/`, `tools/` e `.github/workflows/`.

Aprenda: pasta, ficheiro, caminho relativo, terminal, processo, URL, porta, navegador, Node.js, npm, dependência, Git, commit e diff. Não precisa de dominar tudo agora; precisa de reconhecer onde cada coisa atua.

Experiência: inicie `npm run dev`, abra o endereço mostrado e encontre nas ferramentas do navegador os painéis Elements, Console, Sources, Network e Application/Storage. Pare o servidor com Ctrl+C. Execute `npm test` e distinga um teste de uma utilização manual.

Entrega: um mapa em uma página e a explicação de por que o projeto deve ser servido por HTTP. Explique também por que mudar um ficheiro local não publica automaticamente no GitHub Pages.

## Etapa 2 — HTML, CSS e DOM

**Pergunta:** como o código se transforma numa interface?

Leia apenas um botão de `index.html`, os estilos que o afetam e o início de `src/dom.js`. Depois localize os IDs `activitiesOpen` e `applyActivity`. Siga-os até `src/activities.js`.

Aprenda: elemento, atributo, `id`, classe CSS, seletor, cascata, evento, DOM, `textContent`, `hidden` e `disabled`. DOM é a representação da página em memória que o JavaScript pode consultar e alterar.

Experiência no laboratório: construa uma página com um nome, um número e um botão. Primeiro altere o texto e a cor; depois faça o clique mudar o texto. Observe que editar o DOM no inspetor não altera o ficheiro original.

Entrega: explicar onde se muda o texto, o aspeto e o comportamento do botão. Conseguir seguir um ID do HTML até ao evento em JavaScript.

## Etapa 3 — JavaScript através de alunos e pontos

**Pergunta:** como representar e modificar uma turma em memória?

Leia `src/students.js`, depois `src/points.js` e apenas os auxiliares de `src/utils.js` usados por esses ficheiros. Leia exemplos em `tests/students.test.js`.

Aprenda: `const` e `let`, string, número, booleano, `null`, objeto, array, propriedade, função, parâmetro, retorno, `if`, operadores, `map`, `filter`, `every`, `import` e `export`. Estude referências e mutação: duas variáveis podem apontar para o mesmo objeto.

Experiência: crie três alunos fictícios num array; atribua pontos; encontre os alunos elegíveis para sorteio; ordene uma cópia por pontos. Explique a diferença entre posição no array e identidade do aluno.

Entrega: recriar uma função pequena com o ficheiro original fechado, descrever as entradas e saídas e verificar casos normais e limites. Se a sintaxe ainda impedir a leitura, repita esta etapa com exemplos menores antes de avançar.

## Etapa 4 — Seguir uma funcionalidade completa

**Pergunta:** o que acontece quando atribuo pontos por uma atividade?

Leia o evento de `applyActivity` em `src/activities.js`. Siga `pushHistory`, `studentRef`, `dirty` e `syncAll`, usando a pesquisa do editor para encontrar as definições e chamadas. Em `src/app.js`, leia só os trechos necessários.

O caminho a confirmar é: clique → leitura dos campos → validação → histórico → alteração de pontos → pedido de gravação → atualização visual. O som e a mensagem de confirmação são efeitos adicionais.

Aprenda: evento, condição de saída, efeito colateral, seleção com `Set`, atualização da interface e estado. Distinguir «o aluno tem 5 pontos no objeto» de «o ecrã mostra 5 pontos» e «os 5 pontos foram gravados».

Experiência: com dados fictícios, coloque um ponto de interrupção no evento e acompanhe uma atribuição passo a passo. Anote os valores antes e depois. Descubra o que acontece se não houver seleção ou se os pontos forem inválidos.

Entrega: um desenho desse percurso com os nomes reais das funções. Localizar a causa de uma experiência em que o número muda em memória, mas a interface não é atualizada.

## Etapa 5 — Dados, identidade e compatibilidade

**Pergunta:** qual é a estrutura que o programa guarda e que regras ela tem?

Leia `emptyWorkspace`, a criação de uma turma e a validação em `src/model.js`, por partes. Volte a `src/students.js`. Consulte `tests/model.test.js` e `tests/students.test.js`.

Aprenda: JSON, esquema de dados, validação, normalização, ID, versão e migração. Um workspace é o conjunto de dados da aplicação; a turma aberta é apenas parte dele.

Experiência: desenhe um workspace mínimo com uma turma e dois alunos. Compare corrigir o nome de um aluno com removê-lo e criar outro no mesmo lugar. Leia um caso de conversão de formato antigo e escreva o resultado esperado antes de executar o teste.

Entrega: explicar por que os registos guardam `slot`, `studentId` e `name`; por que a chave de armazenamento contém `v8` e o formato atual é 13; e o que teria de rever ao acrescentar um campo persistente.

## Etapa 6 — Gravação, recuperação e backups

**Pergunta:** como saber se a informação foi realmente guardada?

Leia, nesta ordem: `src/storage.js`, `tests/storage.test.js`, `src/persistence.js`, `tests/persistence.test.js`, `src/backup.js` e os trechos correspondentes de `src/backup-ui.js`.

Aprenda: serialização, `try/catch`, exceção, snapshot (cópia do estado num momento), revisão e conflito. Distinga uma cópia anterior no navegador de um backup descarregado para outro local. O checksum do backup verifica integridade; não cifra nem autentica os dados.

Experiência: use o armazenamento em memória apresentado nos testes. Grave A, grave B e tente gravar novamente a partir da referência antiga A. Explique por que deve surgir um conflito. Faça exportação e importação de dados fictícios e compare o conteúdo.

Entrega: explicar os caminhos de sucesso, armazenamento indisponível, conteúdo inválido e conflito; distinguir «alterado», «guardado» e «incluído no último backup».

## Etapa 7 — Organização dos módulos e arranque

**Pergunta:** como as peças se ligam sem depender de variáveis globais da aplicação?

Leia o final de `src/app.js`, a criação dos controladores, `live` e `withLive`. Use `src/teams.js` e `src/teacher.js` como exemplos. Depois percorra `hub.js` e `roster.js`.

Aprenda: escopo, closure (função que conserva acesso ao contexto onde foi criada), callback (função passada para ser chamada depois), dependência explícita, getter e ordem de inicialização.

Experiência no laboratório: crie dois objetos de turma e uma variável `state`. Compare um controlador que guarda `const antiga = app.state` com outro que lê `app.state` por getter. Troque a turma aberta e observe a diferença.

Entrega: explicar o problema que `live` resolve, identificar quem controla cada botão de uma janela e criar um controlador pequeno com dependências explícitas. Só agora faça uma leitura mais ampla de `app.js`.

## Etapa 8 — Registo de aulas e avaliação

**Pergunta:** como os factos registados se transformam em notas calculadas?

Leia em três percursos:

1. Registar: `lesson-log.js` → `diary-data.js` → `diary.js`; confirme em `tests/diary.test.js`.
2. Calcular: `grading.js` → `tests/grading.test.js` e os casos de cálculo em `tests/demo.test.js`.
3. Mostrar: `grades-ui.js` → `performance.js`, `assessments-ui.js`, `period-grades-ui.js`, `rules-ui.js`, `grade-explain.js` e `grades-format.js`.

Aprenda: data da aula versus momento atual, rascunho e cancelamento, regras configuráveis, média ponderada, arredondamento, dados calculados e CSV.

Experiência: escolha um aluno fictício, duas aulas e um trabalho. Calcule à mão um resultado simples e compare com o programa. Altere um peso e verifique quais resultados são recalculados. Investigue o tratamento de ausência de registos, períodos e critérios incompletos; não adivinhe essas regras.

Entrega: explicar uma nota mostrando os registos e operações que a originaram; distinguir pontos do jogo de notas de avaliação; prever o efeito de mudar uma regra sem mudar os factos registados.

## Etapa 9 — Apresentação, animações e temas

**Pergunta:** como mostrar o jogo de forma dinâmica sem mostrar as notas privadas?

Leia `presentation.js` e `presentation-dom.js`, depois `attention.js` e `raffle.js`. Estude `avatars.js`, `audio.js` e `theme.js` em sessões separadas. Relacione-os com `assets/css/`, `assets/images/`, `tests/game.test.js` e `tests/theme.test.js`.

Aprenda: segunda janela, temporizadores, cancelamento, `canvas`, animação, sprites, som gerado e transformação de cores. Cada assunto pode precisar de um exemplo mínimo próprio.

Experiência: construa primeiro uma contagem de três segundos com um botão cancelar. Só depois procure como a aplicação cancela e limpa o seu estado. Compare os elementos mostrados no projetor com os mostrados ao professor.

Entrega: explicar por que atualizar uma janela inteira pode reiniciar animações; localizar a escolha do vencedor; demonstrar quais dados são excluídos da apresentação. Fazer uma verificação manual de teclado e ecrã pequeno, que os testes com DOM simulado não substituem.

## Etapa 10 — Modo sala e rede

**Pergunta:** como dois aparelhos concordam sobre o que aconteceu?

Leia `Sala.bat`, `tools/serve.js` e `tools/static.js` para se orientar. Depois leia `tools/room.js`, `src/room.js` e `tests/room.test.js` em conjunto, uma operação de cada vez.

Aprenda: cliente, servidor, endereço local, HTTP, pedido e resposta, `fetch`, Promise, `async/await`, polling, espera por eventos, código de acesso e concorrência. O navegador não escreve diretamente no ficheiro do PC: pede ao servidor que o faça.

Experiência: desenhe separadamente o caminho de uma alteração persistente de pontos e o caminho do evento que inicia uma roleta. Observe pedidos no painel Network numa sessão de estudo. Use os testes como primeiro lugar para estudar conflitos e ficheiros danificados.

Entrega: explicar quem guarda os dados principais, o que fica pendente sem ligação, o que acontece num conflito e por que um evento recebido não deve voltar a atribuir os mesmos pontos. Distinguir o código em `src/room.js` do código em `tools/room.js`.

## Etapa 11 — Offline, construção e publicação

**Pergunta:** como o código chega ao utilizador e continua a funcionar sem internet?

Leia `manifest.webmanifest`, `sw.js`, `tools/build.js`, `tests/site.test.js`, `.github/workflows/check.yml` e `.github/workflows/pages.yml`. Reveja `package.json`, `package-lock.json`, `.gitignore`, `.prettierignore`, `.prettierrc.json`, `eslint.config.js`, `.editorconfig` e `.gitattributes`.

Aprenda: cache, service worker, ficheiro gerado, dependência de desenvolvimento, instalação reproduzível, lint, formatação, CI e publicação. Os testes verificam comportamentos escolhidos; não demonstram que todos os cenários reais funcionam.

Experiência: desenhe o que `npm run build` copia para `dist/` e o que exclui. Explique o que teria de atualizar ao acrescentar um módulo público. Localize a condição que impede registar o service worker no modo sala.

Entrega: descrever desde uma edição até à publicação manual, distinguindo os comandos que só verificam, os que modificam ficheiros e os que publicam. Consulte `LICENSE` e `SECURITY.md` para conhecer as condições de distribuição e as premissas de acesso aos dados.

## Etapa 12 — Reconstruir do zero e fazer uma alteração autónoma

**Pergunta:** consigo construir uma solução a partir de requisitos, em vez de copiar a existente?

Numa pasta separada, escreva primeiro os requisitos de uma versão pequena: uma turma, três alunos, pontos e gravação. Implemente por incrementos, verificando cada um antes do seguinte:

1. HTML com nomes e pontos fixos.
2. Array de alunos e função que os mostra.
3. Botão que atribui um ponto e atualiza a interface.
4. Gravação e leitura de JSON no `localStorage`.
5. Exportação, importação e validação básica.
6. IDs de alunos e histórico com anulação.
7. Registo de uma aula e uma regra simples de avaliação.
8. Separação entre regras, armazenamento e interface.
9. Segunda janela de apresentação.
10. Como projeto avançado posterior, servidor local e sincronização.

Não precisa de reproduzir os gráficos, temas e todos os casos antigos de imediato. A versão pequena deve ser compreendida integralmente por si; a compatibilidade com formatos históricos só se torna um requisito se decidir suportá-los.

Para concluir, escolha uma alteração modesta na cópia de aprendizagem: por exemplo, um filtro visual que mostre apenas alunos com pontos acima de um valor. Escreva comportamento esperado, ficheiros envolvidos, casos limites e verificação. Implemente, reveja o diff e explique a alteração sem ler uma resposta da IA. Depois escolha uma mudança nos dados, já considerando validação, gravação, backup e compatibilidade.

## Decisões que merecem uma ficha de estudo

As escolhas abaixo são observáveis no código. A coluna «problema/custo» é uma interpretação técnica do desenho atual; não pretende recuperar intenções dos autores que não estejam registadas.

| Decisão                                        | Problema que resolve e custo a investigar                                                        | Onde confirmar                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Módulos nativos sem framework de interface     | Poucas dependências de execução; atualização do DOM fica a cargo do projeto                      | `index.html`, `src/app.js`, `package.json`                 |
| Controladores com dependências explícitas      | Torna as ligações visíveis; exige organizar a inicialização                                      | `app.js`, `teams.js`                                       |
| Getters para o estado atual                    | Evita referências a uma turma/workspace que já foi substituído                                   | `app.js`, `live`, `withLive`                               |
| 30 posições com IDs próprios dos alunos        | Preserva referências a posições e distingue pessoas; introduz limites e regras de remoção        | `model.js`, `students.js`                                  |
| Gravação do workspace como um conjunto         | Simplifica persistência; torna conflitos e tamanho do conjunto relevantes                        | `storage.js`, `persistence.js`                             |
| Comparação do snapshot completo                | Deteta mudanças que a revisão sozinha pode não distinguir; não cria transações no `localStorage` | `storage.js`, `tests/storage.test.js`                      |
| Validação e migração de formatos               | Permite continuar a ler dados antigos; acrescenta caminhos de manutenção                         | `model.js`, `tests/model.test.js`                          |
| Registos separados de regras de avaliação      | Permite recalcular resultados; exige que a explicação acompanhe as fórmulas                      | `grading.js`, `grade-explain.js`                           |
| Estado persistente separado de eventos ao vivo | Animação e resultado guardado têm necessidades distintas; exige evitar aplicação duplicada       | `room.js` nos dois diretórios, `raffle.js`, `attention.js` |
| CSS recolorido em tempo de execução            | Reaproveita estilos entre temas; torna o mecanismo de cores menos direto                         | `theme.js`, `tests/theme.test.js`                          |
| Lista explícita de ficheiros públicos/offline  | Controla publicação e cache; novos ficheiros exigem atualização das listas                       | `tools/build.js`, `sw.js`, `tests/site.test.js`            |

Para cada decisão escreva: **qual era o problema, qual é a solução, uma alternativa, o custo e que experiência comprova o comportamento**. Não considere uma escolha obrigatória só porque existe neste projeto.

## Usar o Git como livro de evolução

Os commits são fotografias do projeto, não uma gravação de todo o raciocínio. Use a mensagem e o diff como evidência; se a motivação não estiver documentada, escreva «hipótese».

Comandos de consulta, que não trocam a versão em trabalho:

```sh
git log --oneline --reverse
git show --stat f87b2e9
git show 7df3d1d -- src/students.js
git diff 5440911 77445f6 -- src/grades-ui.js
git log -p -- src/storage.js
```

Percurso sugerido:

- `d4fd294`: primeira estrutura de código guardada neste Git; o commit anterior tinha apenas README e licença.
- `f87b2e9`: divisão de `app.js`, modernização e imagens WebP.
- `7df3d1d`: identidade dos alunos e extração das regras do diário.
- `5440911`: expansão do registo, avaliação, temas e aplicação instalável.
- `77445f6`: divisão da janela de avaliação por separadores.
- `449d998` e `7b84bbf`: modo sala e sincronização dos eventos de apresentação.

Exercício: escolha uma mudança, descreva o comportamento anterior e posterior e identifique que teste permite distingui-los. Não leia um diff enorme inteiro na mesma sessão.

## Caderno de aprendizagem

Use esta ficha para cada função ou fluxo estudado:

```text
Ação do utilizador:
Ficheiro e função de entrada:
Vocabulário novo:
Dados lidos:
Dados alterados:
Funções chamadas e porquê:
Onde guarda:
Onde atualiza o ecrã:
O que pode falhar:
Minha previsão da experiência:
Resultado observado:
Explicação pelas minhas palavras:
Dúvida que falta resolver:
```

Escala de progresso por assunto:

- **0:** não sei localizar.
- **1:** localizo e reconheço quando leio.
- **2:** explico sem olhar e prevejo um exemplo.
- **3:** altero ou reconstruo e verifico sozinha.

O objetivo é chegar a 3 nos fluxos principais. Releia temas antigos alguns dias depois; familiaridade imediata não é o mesmo que conseguir usá-los.

## Primeira sessão pronta: identidade de um aluno

Se a sintaxe ainda for nova, comece pela etapa 1 e faça este exercício acompanhada de explicações de JavaScript.

1. Abra `src/students.js` e leia só `emptyStudent()`.
2. Escreva o objeto que a função devolve e explique cada propriedade que reconhecer. Marque as desconhecidas.
3. Leia `setStudentName()`. Preveja o resultado de dar o nome «Ana» a uma posição vazia.
4. Preveja o que acontece ao corrigir para «Ana Silva»: o ID muda? E os pontos?
5. Leia `removeStudent()` e `sameStudent()`. Explique por que uma nova pessoa no mesmo lugar não deve herdar a identidade anterior.
6. Leia os exemplos de `tests/students.test.js` e execute `node --test tests/students.test.js`.
7. Feche os ficheiros e explique a diferença entre **posição**, **nome** e **ID**, com um exemplo seu.

Critério de sucesso: corrigir o nome mantém a identidade e não altera os pontos; remover repõe os campos do aluno; os registos antigos conservam as suas referências. Ao comparar registos com ID, `sameStudent()` usa o ID; nos antigos sem ID, recorre ao nome. Confirme cada afirmação no código.

## IA como apoio ao estudo

Tente primeiro, anote a previsão e a dúvida e só depois peça apoio. Documentação, pesquisa, depurador e testes fazem parte de programar sem IA; não é um exercício de memória absoluta.

Pedidos úteis:

- «Explica os pré-requisitos desta função e faz-me perguntas; ainda não mostres a solução.»
- «A minha previsão é esta. Qual é o primeiro erro no meu raciocínio?»
- «Dá-me uma pista pequena para localizar o problema.»
- «Revisa a alteração que fiz e explica as consequências que não considerei.»

Evite aceitar uma implementação que ainda não consegue explicar. Depois de uma explicação, feche-a e refaça um exemplo diferente. É essa transferência que demonstra aprendizagem.

## Ligar o estudo à utilização em sala

Mantenha um diário de observação separado do caderno de código: ação realizada, resultado esperado, resultado observado, modo usado (site/sala), dispositivo e possibilidade de repetir com dados fictícios. Transforme cada ocorrência numa pergunta de estudo e, quando apropriado, num caso de teste reproduzível.

Os 67 testes aprovados nesta revisão dão uma base de verificação, mas a experiência com toque, projetor, rede, tempo de aula e recuperação de problemas precisa de observação real. Não é necessário conhecer já todos os módulos para começar a registar essas observações.
