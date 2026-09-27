# Decisões do projeto

Este documento regista **porque** o TIC Quest é como é. O [guia](GUIA.md) explica _o que_ existe e _onde_; aqui fica o raciocínio: que problema havia, que caminhos existiam, qual foi escolhido e o que essa escolha custa. Serve para três coisas:

- perceber o código sem ter de adivinhar as intenções;
- decidir mudanças futuras com os mesmos critérios (ou mudar de critério conscientemente);
- saber o que repetir, e o que fazer diferente, num projeto novo.

Cada decisão é uma ficha curta:

> **Problema** · **Opções** · **Decisão** · **Custo** (o que se perde ou fica mais difícil) · **Onde** (ficheiros)

Quando uma decisão mudar, não apague a ficha: acrescente uma nova e marque a antiga como "substituída por D…". O histórico do raciocínio também é informação.

## Índice

| #                                                      | Decisão                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **Princípios**                                         |                                                                                      |
| [P1](#p1-cada-informação-num-só-lugar)                 | Cada informação aparece e edita-se num só lugar                                      |
| [P2](#p2-nunca-destacar-um-aluno)                      | Nenhum aluno é destacado ou exposto sem intenção do professor                        |
| [P3](#p3-predefinições-que-poupam-trabalho)            | Por defeito, o caso mais comum já está feito                                         |
| **Plataforma**                                         |                                                                                      |
| [D1](#d1-aplicação-estática-sem-framework)             | Aplicação estática, sem framework e sem passo de compilação                          |
| [D2](#d2-dados-locais-sem-nuvem)                       | Os dados ficam nos aparelhos do professor, nunca na nuvem                            |
| [D3](#d3-aplicação-instalável-e-offline)               | Instalável e utilizável sem internet                                                 |
| [D4](#d4-interface-em-português-código-em-inglês)      | Interface e documentação em português; código em inglês                              |
| **Dados**                                              |                                                                                      |
| [D5](#d5-um-único-workspace-versionado-e-validado)     | Um único ficheiro de dados, com versão, validado sempre que entra                    |
| [D6](#d6-nunca-escrever-por-cima-de-dados-alheios)     | Nunca escrever por cima de dados de outra janela ou de um ficheiro estragado         |
| [D7](#d7-backups-verificáveis-e-importação-prudente)   | Backups com verificação de integridade; substituir dados faz uma cópia antes         |
| [D8](#d8-30-lugares-fixos-e-um-id-por-aluno)           | 30 lugares fixos por turma e um `id` por aluno                                       |
| **Notas**                                              |                                                                                      |
| [D9](#d9-guardar-factos-calcular-a-nota)               | Guardam-se factos; a nota é sempre calculada                                         |
| [D10](#d10-todos-começam-no-máximo)                    | Todos começam no máximo; só ocorrências reais baixam a nota                          |
| [D11](#d11-uma-nota-tem-de-ser-verificável)            | Cada nota mostra as contas e é testada contra um cálculo independente                |
| [D12](#d12-critérios-de-avaliação-por-trabalho)        | Trabalhos com critérios: guarda-se a nota de cada critério, a do trabalho calcula-se |
| **Ecrã e utilização**                                  |                                                                                      |
| [D13](#d13-aula-de-hoje-e-aula-passada)                | Aula passada abre só de leitura                                                      |
| [D14](#d14-controladores-com-dependências-explícitas)  | Um módulo por ecrã, com as dependências passadas explicitamente                      |
| [D15](#d15-a-apresentação-copia-o-ecrã-não-os-dados)   | A janela do projetor copia o ecrã e nunca recebe os dados                            |
| [D16](#d16-temas-calculados-a-partir-do-tema-original) | Os temas são calculados por regras de cor, não escritos à mão                        |
| **Modo sala**                                          |                                                                                      |
| [D17](#d17-servidor-local-no-computador-do-professor)  | Um pequeno servidor no computador do professor, com os dados num ficheiro            |
| [D18](#d18-sincronização-simples-e-conflitos-raros)    | Sincronização simples: versões numeradas e, em conflito, vence o computador          |
| [D19](#d19-eventos-ao-vivo-para-as-animações)          | Roleta e "Atenção, turma!" passam por eventos; quem recebe só mostra                 |
| **Qualidade**                                          |                                                                                      |
| [D20](#d20-testes-no-node-com-um-navegador-simulado)   | Testes no Node com um navegador simulado, só com dados fictícios                     |

---

## Princípios

Três regras que vieram da utilização real e que pesam em quase todas as decisões seguintes.

### P1. Cada informação num só lugar

- **Problema:** ecrãs que repetem a mesma informação (o sumário em três separadores, o nome de um trabalho editável em dois sítios) confundem: não se sabe qual é a verdadeira nem onde a mudar.
- **Decisão:** cada dado aparece e edita-se num só sítio. Os outros sítios, no máximo, mostram-no só para leitura ou ligam para lá.
- **Exemplos:** os separadores do Registo têm cada um a sua informação; o nome, a data e os critérios de um trabalho só se editam na ficha dele; com critérios, a nota do trabalho não se escreve na tabela geral (é calculada). Também nos dados: um trabalho com critérios guarda as notas por critério e **não** guarda a nota final (ver D12).
- **Custo:** às vezes é preciso um toque a mais para chegar ao sítio certo.

### P2. Nunca destacar um aluno

- **Problema:** um detalhe automático pode expor um aluno perante a turma (por exemplo, dar sempre o avatar de robô a quem tem um nome que o programa não reconhece).
- **Decisão:** nada no ecrã público distingue um aluno sem intenção do professor. Os avatares são sorteados; qualquer aluno pode calhar com um robô; nomes desconhecidos recebem um género aleatório. Notas, observações e registos nunca vão para o projetor (D15).
- **Custo:** o sorteio de avatares é menos "inteligente" do que poderia ser.
- **Onde:** `avatars.js`, `presentation.js`.

### P3. Predefinições que poupam trabalho

- **Problema:** o professor usa a aplicação durante a aula, com pouco tempo. Tudo o que exige um toque por aluno é multiplicado por 30.
- **Decisão:** o caso mais comum já vem feito. Todos começam presentes, com comportamento e participação normais e com material; um toque escolhe diretamente a opção (não é preciso tocar várias vezes); "Vazios → 100" preenche um critério para todos.
- **Custo:** um esquecimento conta como "tudo normal". É intencional: o normal é o mais frequente.

---

## Plataforma

### D1. Aplicação estática, sem framework

- **Problema:** a aplicação tem de funcionar num computador de escola e num tablet, sem instalar nada, e ser mantida por uma pessoa sozinha.
- **Opções:** (a) um framework (React, Vue…) com passo de compilação; (b) HTML, CSS e JavaScript simples, com módulos do próprio navegador (`import`).
- **Decisão:** (b). Os ficheiros de `src/` são exatamente os que o navegador executa; `npm run build` só copia os ficheiros públicos. O GitHub Pages serve-os tal como estão.
- **Custo:** o código que desenha o ecrã é mais manual (criar elementos, atualizar textos à mão). Em compensação, não há dependências que envelheçam, nada para compilar e o que se lê é o que corre.
- **Onde:** `index.html`, `src/*.js`, `tools/build.js`.

### D2. Dados locais, sem nuvem

- **Problema:** os dados são de alunos menores (nomes, faltas, comportamento, notas). Um servidor na nuvem obrigaria a contas, custos, segurança e cumprimento do RGPD.
- **Opções:** (a) servidor na nuvem com contas; (b) dados só nos aparelhos do professor.
- **Decisão:** (b). Nada sai do aparelho: a página proíbe ligações externas (`connect-src 'none'` no `index.html`). Para mudar de aparelho, usa-se um backup (ficheiro).
- **Custo:** não há sincronização automática pela internet, e se o navegador for limpo sem backup, os dados perdem-se. O modo sala (D17) resolve parte disto sem abandonar a regra: os dados passam a um ficheiro no computador do professor, não a um servidor alheio.

### D3. Aplicação instalável e offline

- **Problema:** a rede da escola falha; o tablet deve abrir a aplicação sempre.
- **Decisão:** `manifest.webmanifest` e um _service worker_ (`sw.js`) que usa primeiro a rede e, sem rede, a última cópia guardada. Assim, uma versão nova chega sozinha quando há internet e a antiga continua a funcionar quando não há.
- **Custo:** cada ficheiro público novo tem de ser acrescentado à lista `FILES` em `sw.js` (um teste falha se faltar). No modo sala o _service worker_ não é usado, porque o computador serve sempre a versão atual.

### D4. Interface em português, código em inglês

- **Decisão:** tudo o que o professor lê (ecrã, documentação) está em português de Portugal. Nomes de variáveis, funções e comentários estão em inglês, a língua habitual da programação e das ferramentas.
- **Custo:** quem lê o código mistura duas línguas; o [glossário](GUIA.md#9-glossário) liga os termos (ex.: _assessment_ = trabalho, _lesson_ = aula).

---

## Dados

### D5. Um único workspace versionado e validado

- **Problema:** os dados vêm de sítios em que não se pode confiar cegamente: o armazenamento do navegador, ficheiros de backup (possivelmente antigos ou editados) e, no modo sala, a rede.
- **Decisão:** todos os dados vivem num único objeto, o _workspace_ (professores, turmas, regras da nota), com um número de versão (`VERSION` em `model.js`, hoje 13). **Tudo o que entra passa por `validateWorkspace`**, que verifica cada campo, recusa o que não faz sentido e converte versões antigas para a atual. O resto do código pode então confiar nos dados.
- **Custo:** cada campo novo exige mexer na validação e subir a versão (receita no [guia](GUIA.md#8-receitas-de-manutenção)). Uma versão antiga da aplicação recusa backups mais novos, em vez de os abrir mal.
- **Onde:** `model.js`, `grading.js` (validação das regras e dos trabalhos).

### D6. Nunca escrever por cima de dados alheios

- **Problema:** com duas janelas abertas, ou depois de uma gravação interrompida, gravar sem pensar pode apagar o trabalho de outra janela.
- **Decisão:** antes de gravar, compara-se o que está guardado com o que esta janela leu da última vez; se for diferente, **a gravação é bloqueada** e o professor é avisado. Guarda-se sempre também a versão anterior (`.previous`). Se os dados guardados não se conseguem ler, abre-se a anterior e a gravação fica suspensa até haver backup.
- **Custo:** em casos raros, o professor vê um aviso e tem de recarregar. Preferiu-se um aviso a uma perda silenciosa.
- **Onde:** `storage.js`, `persistence.js`.

### D7. Backups verificáveis e importação prudente

- **Decisão:** o backup leva uma soma de verificação (_checksum_); um ficheiro alterado ou incompleto é recusado. Importar oferece duas formas: **como novas turmas** (junta, sem apagar nada) ou **substituir** (pede confirmação e descarrega antes uma cópia do que vai ser substituído).
- **Custo:** um backup editado à mão deixa de ser aceite.
- **Onde:** `backup.js`, `backup-ui.js`.

### D8. 30 lugares fixos e um `id` por aluno

- **Problema:** os registos antigos apontam para um lugar da turma (0–29). Se os lugares mudassem, o histórico apontaria para o aluno errado. Além disso, corrigir um nome mal escrito não pode "criar" um aluno novo.
- **Decisão:** cada turma tem sempre 30 lugares; um lugar vazio fica vazio. Desde a versão 11, cada aluno com nome tem um `id`. **Corrigir o nome mantém o `id`**; "Remover aluno" liberta o lugar. Os registos guardam o `id` e o nome da altura.
- **Custo:** um limite de 30 alunos por turma.
- **Onde:** `students.js`, `model.js`.

---

## Notas

### D9. Guardar factos, calcular a nota

- **Problema:** no primeiro ano de lançamento de notas, as regras (pesos, valores de cada marcação) ainda vão mudar. Se a nota fosse guardada, mudar uma regra obrigaria a refazer tudo.
- **Decisão:** guarda-se só **o que aconteceu** (faltas, atrasos, comportamento, participação, material, notas dos trabalhos). A nota do período **nunca é guardada**: é sempre calculada por `grading.js` a partir desses factos e das regras atuais.
- **Custo:** a nota é recalculada sempre que se abre a Avaliação (é rápido). Uma nota lançada no Inovar pode deixar de coincidir se as regras mudarem depois; por isso as regras devem ser fixadas antes do lançamento.
- **Onde:** `grading.js` (sem ecrã, fácil de testar), `grades-ui.js` e os módulos dos separadores.

### D10. Todos começam no máximo

- **Decisão:** sem marcações, comportamento, participação e assiduidade valem 100. "Normal" vale sempre 100 (não é editável); só as ocorrências (atraso, falta, "A melhorar"…) baixam a média, e as aulas seguintes sem ocorrências vão recuperando. Uma falta justificada não conta.
- **Sem trabalhos, não há nota final.** Antes, um aluno sem nenhum trabalho aparecia com 5,00, o que era enganador. Agora mostra "—" e, à parte, a **nota máxima ainda possível**.
- **Custo:** a nota a meio do período é uma fotografia provisória; os ecrãs indicam isso (asterisco, "provisória").

### D11. Uma nota tem de ser verificável

- **Problema:** uma nota que ninguém consegue conferir não merece confiança, sobretudo perante encarregados de educação.
- **Decisão:** tocar num aluno mostra **"Como foi calculada"**, com os números de cada parte ("7 × sem ocorrências (100) + 3 × falta (0) = 700 ÷ 10 aulas"). A turma fictícia 5ºX (`npm run demo`) tem 30 alunos com um cenário cada, e `tests/demo.test.js` compara todas as notas com **um cálculo independente**, escrito diretamente a partir das regras e sem usar `grading.js`.
- **Custo:** cada regra nova tem de ser acrescentada à explicação e ao cálculo de referência.

### D12. Critérios de avaliação por trabalho

- **Problema:** um trabalho avalia várias competências (criar uma pasta, guardar o ficheiro, escrever o texto), e uma nota única esconde isso.
- **Decisão:** cada trabalho pode ter critérios com pesos que **têm de somar 100**. Guarda-se a nota de cada critério (`marks`); a nota do trabalho é calculada (Σ nota × peso ÷ 100) e só aparece quando todos os critérios têm nota e os pesos somam 100. Um trabalho sem critérios continua com a nota única (`scores`). Nunca existem as duas ao mesmo tempo (P1).
- **Custo:** acrescentar critérios a um trabalho que já tinha notas diretas apaga-as (com aviso).
- **Onde:** `grading.js` (`assessmentScore`), `assessments-ui.js`.

---

## Ecrã e utilização

### D13. Aula de hoje e aula passada

- **Problema:** abrir uma aula antiga para consultar e alterar algo sem querer.
- **Decisão:** cada turma tem **▶ Aula de hoje** e **📅 Aula passada**. Uma aula passada abre **só de leitura**; alterá-la exige "✎ Editar esta aula" (com confirmação) e termina com "✓ Terminar edição". Ao voltar a entrar, está de novo só de leitura. Tudo o que se faz fica datado no dia da aula aberta.
- **Onde:** `app.js` (`sessionDay`, `readOnly`, `EDIT_CONTROLS`), `hub.js`, `diary.js`.

### D14. Controladores com dependências explícitas

- **Problema:** o ficheiro inicial tinha mais de 2 000 linhas com tudo misturado; mexer numa parte partia outra.
- **Decisão:** cada ecrã ou função é um módulo com uma função `createX(app)` que recebe **explicitamente** aquilo de que precisa (`$`, `dirty`, `openOverlay`…). `app.js` cria-os e liga-os. Valores que mudam enquanto a aplicação corre (a turma aberta, o workspace) são lidos por _getters_ (`live`), nunca copiados. As regras sem ecrã (cálculo de notas, diário, validação) vivem em módulos sem DOM, testáveis diretamente. Quando um módulo cresce demasiado, divide-se (a Avaliação passou de 924 linhas para um módulo por separador).
- **Custo:** para seguir um clique é preciso saltar entre ficheiros; o [guia](GUIA.md#5-o-que-acontece-quando) descreve os percursos principais.

### D15. A apresentação copia o ecrã, não os dados

- **Problema:** o projetor mostra o jogo à turma, mas o professor tem no mesmo computador notas e observações privadas.
- **Decisão:** a janela de apresentação recebe **cópias do ecrã do jogo** (atualizadas continuamente), sem formulários nem campos, e **nunca** recebe o workspace. Só os botões de uma lista fixa (`projectionAllowed`) funcionam lá; o clique é passado ao botão verdadeiro da janela principal.
- **Custo:** o que aparece no projetor é o que está no ecrã principal; não há um "ecrã do projetor" independente.
- **Onde:** `presentation.js`, `presentation-dom.js`.

### D16. Temas calculados a partir do tema original

- **Problema:** manter quatro folhas de estilo (roxo, verde, preto, claro) em paralelo é quatro vezes o trabalho, e cada cor nova esquecida num tema fica errada.
- **Decisão:** o CSS é escrito só para o tema roxo. `theme.js` percorre as regras de estilo e transforma cada cor segundo regras de teoria das cores (base verde com rosa complementar; base neutra com acentos vivos; claro com fundos claros, texto escuro e faixas coloridas em tons pálidos).
- **Custo:** uma cor com um papel especial pode precisar de uma regra própria em `theme.js`. O tema é uma preferência do aparelho e não entra nos backups.

---

## Modo sala

### D17. Servidor local no computador do professor

- **Problema:** usar o tablet na mão e o computador no projetor ao mesmo tempo. Cada aparelho tinha a sua cópia dos dados; dar pontos num deixava o outro desatualizado.
- **Opções:** (a) sincronizar pela nuvem (contraria D2); (b) o tablet ligado ao projetor (mostraria à turma os dados privados); (c) cada aparelho com uma função (os dados continuariam separados); (d) o computador guarda os dados e os outros aparelhos ligam-se a ele pela rede local.
- **Decisão:** (d). `tools/room.js` é um pequeno servidor em Node, aberto com `Sala.bat`, que serve a aplicação e guarda os dados num ficheiro (`Documentos\TIC Quest\dados.json`), com cópias automáticas e escrita segura (ficheiro temporário + renomear). Outros aparelhos na mesma rede entram com um código de 6 dígitos; o próprio computador não precisa dele. É **opcional**: sem ele, tudo funciona como antes.
- **Porque é que encaixa no resto:** a aplicação já gravava através de um "armazenamento" trocável (D6). No modo sala, `src/room.js` fornece um armazenamento com a mesma forma que, em vez do navegador, fala com o computador. Quase nada do resto da aplicação mudou.
- **Custo:** é preciso instalar o Node.js e deixar a janela da sala aberta; a ligação na rede local não é cifrada (por isso o código e a recomendação de uma rede com palavra-passe).

### D18. Sincronização simples e conflitos raros

- **Decisão:** o computador numera cada versão dos dados. Um aparelho envia as suas alterações dizendo "partindo da versão N"; se entretanto outro gravou, o computador recusa e devolve a versão atual. Nesse caso **vencem os dados do computador** e o que não foi enviado é descarregado como ficheiro, para nada se perder em silêncio. De 1,5 em 1,5 segundos, cada aparelho pergunta se há novidades. Sem rede, as alterações ficam no aparelho e são enviadas quando a ligação volta. Abrir outra turma num aparelho não conta como alteração, e o computador segue a turma aberta no tablet.
- **Porque não algo mais sofisticado:** juntar automaticamente alterações simultâneas (como fazem os editores colaborativos) é muito mais complexo. Aqui só uma pessoa usa a aplicação de cada vez, por isso os conflitos são raros e basta tratá-los com segurança.
- **Custo:** se duas pessoas alterassem os dados ao mesmo tempo com frequência, uma delas veria avisos. Não é o caso de uso.

### D19. Eventos ao vivo para as animações

- **Problema:** a roleta e o "Atenção, turma!" são animações, não dados; sincronizar os dados não os mostra no projetor.
- **Decisão:** um canal de **eventos ao vivo** no servidor. O aparelho onde se sorteia **escolhe o vencedor** e envia-o; o computador roda a mesma roleta e pára no mesmo aluno. Quem recebe um evento **só mostra**: os pontos e as vidas chegam pelos dados (D18), por isso nunca são aplicados duas vezes. Para não haver atraso, o computador fica "à escuta" (o pedido só responde quando há um evento). Eventos com mais de 5 segundos são ignorados.
- **Custo:** cada nova animação partilhada precisa de um tipo de evento e de uma função que a mostre sem mexer nos dados.
- **Onde:** `tools/room.js` (`/api/events`), `src/room.js` (`send`, `listen`), `raffle.js` e `attention.js` (`fromRoom`).

---

## Qualidade

### D20. Testes no Node com um navegador simulado

- **Decisão:** os testes usam o executor do próprio Node (`node --test`) e o **jsdom**, um navegador simulado, para percorrer ecrãs completos (criar turma, dar pontos, registar, avaliar, modo sala com um servidor verdadeiro). Só com dados fictícios. `npm run check` (formatação, lint e testes) corre no GitHub a cada envio.
- **Custo:** o jsdom não desenha: o aspeto visual continua a ser verificado à mão, no navegador.

---

## Como decidir daqui para a frente

Antes de uma mudança grande, responder por escrito (pode ser numa ficha nova):

1. **Que problema real resolve?** Aconteceu numa aula, ou é hipotético?
2. **Respeita os princípios?** Uma informação num só sítio (P1), nenhum aluno exposto (P2), o caso comum já feito (P3).
3. **Mexe no formato dos dados?** Se sim: validação, nova versão, conversão das antigas e um teste de ida e volta (D5).
4. **Os dados continuam no professor?** (D2)
5. **Como se testa?** Um teste que falharia sem a mudança.
6. **Qual é o custo?** O que fica mais difícil, e se vale a pena.

## Se começasse do zero hoje

O que repetiria e o que faria diferente, sabendo o que se sabe agora.

- **Repetiria:** guardar factos e calcular a nota (D9); validar tudo o que entra (D5); módulos pequenos com dependências explícitas (D14); cálculo de referência nos testes (D11); dados no professor (D2).
- **Faria mais cedo:** pensar o formato dos dados com calma no primeiro dia (mudou 13 vezes, e cada mudança exige conversões); separar os ficheiros desde o início, em vez de partir depois um HTML de 11 MB; escrever esta lista de decisões à medida que se decide.
- **Consideraria:** TypeScript (o editor apanharia erros de campos em falta que hoje só os testes apanham); IndexedDB em vez de `localStorage` se os dados crescerem muito; um framework leve só se os ecrãs se tornarem muito mais interativos.
