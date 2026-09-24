# Revisão técnica — 23 de setembro de 2026

## Alterações concluídas

| Problema                                                   | Alteração                                                                                |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| HTML de cerca de 11,4 MB com base64 e código comprimido    | Entrada HTML, módulos ES, estilos por área e cinco imagens externas                      |
| Funções/handlers antigos sobrescritos por novas versões    | Remoção das implementações obsoletas e integração das correções nas funções responsáveis |
| Importação recente contornava o limite anterior            | Limite comum antes de ler ficheiros e interpretar texto                                  |
| Conflitos avaliados só pela revisão                        | Comparação do snapshot completo; deteção também de remoção/limpeza                       |
| Anulação aplicava pontos a quem ocupasse a posição antiga  | Bloqueio se o nome atual divergir ou a pontuação exceder os limites                      |
| Pontuação de equipas podia ultrapassar inteiros seguros    | Verificação antes de alterar                                                             |
| Diário renderizava um rascunho anterior antes de o renovar | Preparação do rascunho antes de carregar a aula                                          |
| Apresentação dependia de estilos embutidos                 | Ligações para CSS externo válidas em subpastas                                           |
| Sem verificações ou documentação de manutenção             | Prettier, ESLint, testes, lockfile, CI, arquitetura e diretório público controlado       |

## Verificação

Os testes cobrem formatos antigos, round trip e corrupção de backup, limites de importação, validação, conflitos de gravação, quota, anulação de pontos e um fluxo integrado de turma, pontos, vidas, equipas, diário, TPC, importação e apresentação. O teste de apresentação usa DOM simulado e confirma a exclusão do diário.

A verificação visual inicial num navegador real confirmou arranque, criação de turma, imagens e início da roleta sob `/classroom-quest/`. Não substitui uma sessão completa em vários navegadores e dispositivos.

## Limites e melhorias futuras

- **Dados locais sem autenticação/cifragem:** o acesso ao computador/perfil tem de ser controlado. Isolamento entre professores exige outro desenho de armazenamento e acesso.
- **Identidade por posição/nome:** a anulação é agora conservadora, mas alunos com o mesmo nome não têm identidade independente. Introduzir IDs de aluno exige migração dos históricos.
- **Concorrência:** snapshots reduzem sobrescritas, mas `localStorage` não oferece transação compare-and-swap. Edição simultânea em várias janelas não é suportada.
- **Manutenção:** `app.js` foi dividido em controladores (turmas, professor, alunos, equipas, atividades, roleta, atenção, backup e persistência). `diary.js` (~1000 linhas) é agora o maior módulo; relatórios e calendário podem ser separados quando necessário.
- **CSS herdado:** a cascata foi preservada. Eliminar regras sobrepostas e reduzir `!important` requer testes visuais.
- **Avatares:** o comportamento herdado infere uma opção visual pelo primeiro nome e inclui aleatoriedade. Uma escolha explícita do utilizador seria mais previsível.
- **Imagens:** convertidas para WebP (de ~8,2 MB para ~2 MB, mesma resolução). A procedência/licença precisa de confirmação.
- **Ensaio antes da utilização real:** backup e restauro num perfil separado, pop-ups bloqueados, perda de armazenamento, teclado, dispositivo móvel e roleta com a janela principal minimizada.

O repositório foi preparado para publicação manual; nenhum deploy é necessário para rever estas alterações.
