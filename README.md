# TIC Quest · Classroom Quest

Jogo de sala de aula para professores. Transforma a turma numa equipa de jogadores com avatares, pontos, níveis e vidas, e junta um diário da turma para registar aulas, presenças e trabalhos de casa.

**Aplicação publicada:** <https://luanabuscariolo.github.io/classroom-quest/>

Funciona inteiramente no navegador: não há contas, servidor de dados nem serviços externos. Os dados ficam no navegador de quem usa e podem ser exportados em backups JSON.

## Funcionalidades

- **Turmas:** até 30 alunos por turma, com avatar em pixel art escolhido automaticamente pelo nome (pode ser trocado); turmas podem ser arquivadas. Corrigir o nome de um aluno mantém os seus pontos e histórico; "Remover aluno da turma" liberta o lugar.
- **Pontos e níveis:** pontos individuais, atividades frequentes (ex.: "TPC entregue") e histórico com anulação segura. A cada 20 pontos o aluno sobe de fase.
- **Vidas da turma:** a turma tem 5 vidas partilhadas; perder todas mostra _game over_.
- **Atenção, turma!:** contagem de 10 segundos para fazer silêncio; se a turma não cumprir, perde uma vida.
- **Sorteio:** roleta com os alunos marcados como "no sorteio".
- **Equipas:** sorteio de até 6 equipas, com pontuação própria.
- **✎ Registo (diário da turma):** a data da aula escolhe-se uma vez, ao entrar na turma. Separadores: **Sumário** (sumário e atividades), **Presença**, **Comportamento**, **Participação**, **Material** (cada aluno mostra as opções em emoji; um toque escolhe), **TPC** (nova TPC com prazo e verificação das entregas de uma TPC concreta) e **Observação** (nota geral da turma e observação por aluno). Cada informação tem um só lugar. Tudo grava enquanto escreve; **Salvar e sair** confirma e **Cancelar** repõe o que estava ao abrir. O histórico por dia mostra cada aula de forma fácil de ler.
- **Desempenho:** histórico de cada aluno aula a aula (sem médias), com filtro: tudo, só comportamento, participação, assiduidade ou TPC, uma aula concreta, ou a média até uma aula.
- **Verificar uma nota:** em Notas do período ou Acompanhamento, toque num aluno para ver **como foi calculada**, com todos os números.
- **Temas:** Roxo, Verde, Preto e Claro, escolhidos na tela inicial (ficam guardados neste aparelho).
- **Acompanhamento:** tabela em que todos começam no máximo em cada categoria e vão descendo (ou recuperando) aula a aula, com a nota máxima ainda possível.
- **Avaliação e notas do período:** ficha de cada trabalho (data, descrição e critérios de avaliação com pesos que somam 100), notas dos trabalhos (0–100) ou por critério, nota do período calculada a partir dos registos com regras editáveis (pesos, valores, datas dos períodos), modo de lançamento no Inovar e exportação para Excel. Os registos guardam o que aconteceu; a nota é recalculada, por isso as regras podem mudar no fim do período.
- **Apresentação:** uma segunda janela para o projetor mostra apenas o jogo; o diário e as notas privadas ficam no ecrã do professor.
- **Modo sala:** o tablet comanda tudo e o PC mostra a apresentação; os dados ficam num ficheiro no PC, com cópias automáticas.
- **Backup e restauro:** exportação completa ou por turma, com verificação de integridade; importação como cópia ou em substituição.

## Como usar

1. Abra a aplicação, indique o seu nome, título e personagem e guarde.
2. Crie uma turma e cole os nomes dos alunos, um por linha.
3. Entre na turma para jogar; use **▣ Apresentar** para abrir a janela do projetor.
4. Em cada turma, **▶ Aula de hoje** abre a aula do dia. **📅 Aula passada** abre uma aula anterior **só para leitura**; para a alterar, toque em **✎ Editar esta aula** e, no fim, em **✓ Terminar edição**. Tudo o que fizer fica gravado no dia dessa aula.
5. Use **✎ Registo** durante a aula e **◆ Avaliação** para os trabalhos e as notas do período.
6. **Descarregue um backup com regularidade.** É a única forma de levar os dados para outro computador ou navegador e de os recuperar se o navegador for limpo.

### Modo sala: tablet + PC do projetor

Para usar o tablet para tudo e o PC só para a apresentação, com os dados sempre iguais nos dois. Os dados ficam num ficheiro no PC (`Documentos\TIC Quest\dados.json`), com cópias automáticas; nada vai para a internet.

1. **Uma vez:** instale o [Node.js](https://nodejs.org) (versão LTS) no PC e tenha a pasta deste projeto no PC.
2. **Em cada aula:** ligue o PC e o tablet ao hotspot do telemóvel e dê dois cliques em **`Sala.bat`** (na pasta do projeto). Abre-se uma janela preta com o endereço para o tablet e o **código da sala**, e o navegador do PC já na aplicação.
3. No tablet, abra no Chrome o endereço mostrado (ex.: `http://192.168.43.20:4180`) e escreva o código (só na primeira vez).
4. No PC, entre na turma e toque em **▣ Apresentar**; leve essa janela para o projetor. A partir daí, tudo o que fizer no tablet aparece no projetor em 1–2 segundos.

Na primeira vez, o Windows pergunta se o Node.js pode usar a rede: **permita** (se o hotspot aparecer como rede pública, marque também "Redes públicas"). Passo a passo e resolução de problemas no [guia](docs/GUIA.md#se-usa-o-tablet-com-o-pc-da-sala-modo-sala).

### Instalar no tablet (Android)

Abra o endereço da aplicação no Chrome e escolha **⋮ → Adicionar ao ecrã principal / Instalar aplicação**. Depois da primeira abertura com internet, funciona sem rede. Os dados ficam só nesse aparelho: faça backups e guarde-os fora do tablet.

## Os seus dados

- Tudo é guardado no `localStorage` do navegador, associado ao endereço do site e ao perfil do navegador. Mudar de computador, de navegador ou de endereço (ex.: de `localhost` para o GitHub Pages) **não** leva os dados: exporte um backup completo e importe-o no novo local.
- Não existe autenticação nem cifragem. Quem usar o mesmo perfil do navegador pode ver e alterar as turmas. O perfil de professor é uma preferência, não uma conta.
- Os backups completos e os relatórios de dia completo incluem notas privadas. Guarde-os em local seguro e **nunca** os coloque no repositório.
- Use uma só janela de gestão (mais a janela de apresentação). Se outra janela alterar os dados, a gravação automática é suspensa e aparece um aviso.

Mais detalhes em [segurança e privacidade](SECURITY.md).

## Desenvolvimento

Requisito: [Node.js](https://nodejs.org/) 24 ou superior. Não há framework nem dependências de produção; as dependências de desenvolvimento servem apenas para testes, lint e formatação.

```sh
npm ci        # instalar dependências de desenvolvimento
npm run dev   # servidor local
```

Abra <http://127.0.0.1:4173/classroom-quest/>. O prefixo `/classroom-quest/` simula o endereço do GitHub Pages. Para mudar a porta, defina a variável de ambiente `PORT`.

Não abra `index.html` com duplo clique: os módulos JavaScript precisam de ser servidos por HTTP.

### Comandos

| Comando          | O que faz                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm run dev`    | Servidor local em `127.0.0.1`                                                                                 |
| `npm run sala`   | Modo sala: dados em `Documentos\TIC Quest`, tablet ligado pela rede local com código (o mesmo que `Sala.bat`) |
| `npm run format` | Formata HTML, CSS, JS e Markdown com Prettier                                                                 |
| `npm run lint`   | ESLint                                                                                                        |
| `npm test`       | Testes com o executor nativo do Node (`node --test`)                                                          |
| `npm run check`  | Formatação + lint + testes (o mesmo que a CI executa)                                                         |
| `npm run build`  | Copia apenas os ficheiros públicos para `dist/`                                                               |
| `npm run demo`   | Cria `TIC_DEMO_5X.json`: turma fictícia 5ºX (30 alunos, 10 aulas, trabalhos) para importar e experimentar     |

Os testes usam apenas dados fictícios. Nunca acrescente backups reais como fixtures.

### Organização

| Local                                                                                                                                          | Responsabilidade                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `manifest.webmanifest`, `sw.js`                                                                                                                | App instalável e uso sem internet                                                          |
| `index.html`                                                                                                                                   | Estrutura da interface (sem CSS nem JavaScript embutidos)                                  |
| `assets/css/`                                                                                                                                  | Estilos por área: base, feedback, jogo, gestão, diário, apresentação                       |
| `assets/images/`                                                                                                                               | Cenário e folhas de sprites (WebP)                                                         |
| `src/app.js`                                                                                                                                   | Ponto de entrada: tabuleiro de jogo, overlays e ligação dos módulos                        |
| `src/diary.js`, `src/lesson-log.js`                                                                                                            | ✎ Registo: aula do dia (grelha de alunos, sumário, TPC, nota da turma) e histórico por dia |
| `src/diary-data.js`                                                                                                                            | Regras do diário (aulas, prémios de TPC) e textos dos relatórios, sem DOM                  |
| `src/grades-ui.js` e módulos dos separadores (`performance.js`, `assessments-ui.js`, `period-grades-ui.js`, `rules-ui.js`, `grade-explain.js`) | Janela de avaliação: desempenho, trabalhos, notas do período e regras                      |
| `src/grading.js`                                                                                                                               | Regras e cálculo da nota do período, exportação CSV (sem DOM)                              |
| `src/hub.js`, `src/teacher.js`                                                                                                                 | Lista de turmas e perfil do professor                                                      |
| `src/roster.js`, `src/teams.js`                                                                                                                | Nomes/avatares dos alunos e equipas                                                        |
| `src/activities.js`, `src/raffle.js`                                                                                                           | Pontos por atividade e roleta de sorteio                                                   |
| `src/attention.js`                                                                                                                             | Contagem "Atenção, turma!"                                                                 |
| `src/backup-ui.js`                                                                                                                             | Ecrãs de backup, importação e avisos de gravação                                           |
| `src/students.js`                                                                                                                              | Identidade dos alunos: IDs, correção de nome e remoção                                     |
| `src/persistence.js`, `src/storage.js`                                                                                                         | Dono do workspace; gravação local e deteção de conflitos                                   |
| `src/model.js`                                                                                                                                 | Validação e normalização dos dados; compatibilidade de versões                             |
| `src/backup.js`                                                                                                                                | Formato do backup e verificação de integridade                                             |
| `src/points.js`                                                                                                                                | Condições para anular pontos em segurança                                                  |
| `src/avatars.js`, `src/audio.js`                                                                                                               | Personagens e sons sintetizados                                                            |
| `src/presentation.js`, `src/presentation-dom.js`                                                                                               | Janela de apresentação e atualização do seu DOM                                            |
| `src/dom.js`, `src/utils.js`, `src/theme.js`                                                                                                   | Utilitários de DOM e datas; temas de cores                                                 |
| `tests/`                                                                                                                                       | Testes de dados, persistência e fluxos integrados (com jsdom)                              |
| `tools/`                                                                                                                                       | Servidor local, modo sala (`room.js`), preparação de `dist/` e turma de demonstração       |
| `docs/`                                                                                                                                        | Guia completo, arquitetura e revisão técnica                                               |

Para compreender o projeto de ponta a ponta (ficheiros, dados, versões, receitas de manutenção), comece pelo [guia completo](docs/GUIA.md). Antes de alterar fluxos com estado ou o formato dos dados, leia [a arquitetura](docs/ARQUITETURA.md). Os limites conhecidos e melhorias previstas estão na [revisão técnica](docs/REVISAO.md).

## Publicação no GitHub Pages

A publicação é manual; os pushes e pull requests apenas executam as verificações.

1. Em **Settings → Pages → Build and deployment → Source**, escolha **GitHub Actions** (apenas na primeira vez).
2. Em **Actions → Publicar no GitHub Pages**, clique em **Run workflow** na branch pretendida.
3. O workflow executa `npm run check`, cria `dist/` e publica-o. O endereço aparece no resultado do deployment.

`dist/` contém apenas HTML, módulos, estilos, imagens e a licença: nunca dependências, testes ou backups. Ver também a [documentação do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Licença

[Licença própria de uso pessoal e estudo não comercial](LICENSE). Não é software livre/open source.

- **Permitido:** usar, estudar, modificar e partilhar gratuitamente, para fins pessoais e de estudo não comerciais.
- **Proibido:** vender, cobrar acesso, oferecer como serviço pago ou incorporar em produtos ou serviços comerciais, incluindo versões modificadas.
- As cópias devem manter a autoria e a licença; modificações distribuídas devem incluir o código-fonte nas mesmas condições.

Dependências e materiais de terceiros mantêm as suas licenças. A origem e a licença das imagens ainda devem ser confirmadas antes de uma distribuição pública. Versões anteriormente distribuídas sob MIT mantêm essa licença.
