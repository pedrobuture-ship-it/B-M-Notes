# Prompts

Pedidos feitos durante o desenvolvimento, em ordem. O Client ID do GitHub OAuth App (público, sem segredo) é `Ov23li8KuIIKb5wDdfrb`.

1. Descobrir onde fica o repositório remoto do projeto.
2. Renomear o app para **b&m notes** e trocar o logo por um lobo em arte desenhada.
3. Commit e push.
4. Criar um **modo claro amarelado**, mantendo o modo escuro atual.
5. Facilitar ligar os cards: **duas bolinhas, uma de cada lado**, para puxar e ligar um card no outro.
6. Ao ligar, **escrever automaticamente o `[[link]]` dentro do `.md`**.
7. Corrigir a seta que aparecia com duas listras; deixar **só uma seta calculada**.
8. Permitir **deletar as setas** com `Delete`, apagando também a marcação dentro do `.md`.
9. Commit e push.
10. Escolher um Google Drive para backup e trabalho em dupla na mesma pasta (**plano**).
11. Comparar as opções B (rclone) e C (Git).
12. Fazer o login pelo navegador no **GitHub**, como recurso **opcional** (**plano**).
13. Salvar os prompts neste arquivo e seguir com a implementação.

## Plano de sincronização com o GitHub (opcional)

1. **Login** pelo Device Flow: código no app, autorização no navegador, token em arquivo na pasta de configuração do app (0600).
2. **Ligar a pasta a um repositório**: criar novo, escolher um existente ou colar a URL.
3. **Motor de sincronização** com o `git` do sistema: commit automático, `fetch` periódico, `push`.
4. **Conflitos**: merge de texto por linha; tela com "minha", "do outro" ou "as duas"; merge por card no `board.json`.
5. **Interface**: ícone de status no cabeçalho, painel de sincronização, aviso ao editar.
6. **Testes e documentação**.

Implementado nas fases 1 a 6 (login, ligar repositório, motor `git`, conflitos, interface, testes e README).

Tudo desligado por padrão: sem conectar, o app não faz nenhuma chamada de rede.

---

# Rodada 2 — prompts gerados

Pedido original: *"faça vários murais por pasta, escrita, busca e navegação, e qualidade e segurança; gere todos os prompts, salve na raiz e vá seguindo, não me pergunte nada, depois commit na main"*.

Cada item abaixo é um prompt autocontido; a implementação segue a ordem numérica.

## 1. Vários murais por pasta
> Permita vários murais na mesma pasta. O mural atual (`.mural/board.json`) continua sendo o mural "Main", que mostra todas as notas. Murais extras ficam em `.mural/boards/<id>.json` e são curados: só mostram as notas adicionadas a eles. Crie um seletor de murais (abas) na vista do mural com criar (vazio ou cópia do atual), renomear e apagar. Em murais extras, "Delete" no card só tira do mural, nunca apaga o arquivo. Adicione "Add to board" no menu da nota. O sync precisa fazer merge por card também nesses arquivos. Mantenha compatibilidade total com pastas antigas.

## 2. Modelos de nota
> Comando "New note from template". Modelos vêm da pasta `templates/` do workspace e de 3 modelos embutidos (reunião, projeto, leitura). Variáveis `{{title}}`, `{{date}}`, `{{time}}`. Um seletor com busca; depois pede o título e cria a nota já aberta.

## 3. Embeds `![[nota]]`
> Mostre o conteúdo de outra nota dentro do preview quando houver `![[nota]]`, com limite de profundidade e proteção contra ciclos, e um cabeçalho clicável para abrir a nota original. Suporte `![[nota#Seção]]` mostrando só a seção.

## 4. Links para seções `[[nota#título]]` e autocompletar
> Ao clicar num link com `#título`, abra a nota e role até a seção (preview e editor). No editor, digitar `[[` sugere notas; depois de `[[nota#` sugere os títulos daquela nota; `#` no início de uma palavra sugere tags.

## 5. Notas órfãs, menções sem link e tarefas globais
> Na página da nota, mostre "menções sem link" (outras notas que citam o título mas não linkam) com botão "Linkar". Crie uma tela de Tarefas que junte todos os `- [ ]`/`- [x]` de todas as notas, com filtro, agrupamento por nota, marcar direto na tela e abrir a nota.

## 6. Buscas salvas
> Na busca, permita salvar a consulta atual com um nome. Buscas salvas aparecem no topo da barra lateral e na paleta de comandos e reabrem a busca com a consulta preenchida. Ficam em `.mural/settings.json`.

## 7. Navegação: voltar/avançar, recentes e fixadas
> Histórico de navegação (nota/mural/grafo) com `Alt+←` / `Alt+→` e botões no cabeçalho. Notas fixadas (menu de contexto "Pin") e recentes (últimas 8) no topo da lista de notas.

## 8. Propriedades (frontmatter)
> Leia o frontmatter `---\nchave: valor\n---` (valores simples e listas `[a, b]`). Crie uma tela "Propriedades" em formato de tabela (notas × propriedades) com ordenação, filtro e abrir a nota. Mostre as propriedades como chips na página da nota. Suporte `chave:valor` na busca.

## 9. Rename para links Markdown comuns
> Estenda o rename inteligente para `[texto](nota.md)` (caminhos relativos): ao renomear ou mover uma nota, recalcule o caminho relativo em todas as notas, inclusive nas que também mudaram de pasta.

## 10. Backup local em ZIP
> Comando "Back up now" que gera `nome-AAAAMMDD-HHMM.zip` da pasta (sem `.git`, `node_modules`, lixeira e backups) numa pasta escolhida. Opção de backup automático ao abrir a pasta quando o último tem mais de 24 h, mantendo os N mais recentes.

## 11. Verificador de saúde das notas
> Tela "Vault health": links quebrados (com sugestão do nome mais parecido e botões "Corrigir" e "Criar nota"), notas órfãs e notas sem título. Atualiza ao vivo.

## 12. Atalhos configuráveis
> Todos os atalhos globais passam a ser configuráveis em Configurações → Keyboard (gravar nova combinação, detectar conflito, restaurar padrão). Salvos em `.mural/settings.json`.

## 13. Criptografar nota com senha
> "Encrypt note…" cifra a nota com senha (AES-GCM 256, chave derivada por PBKDF2). O arquivo guarda só o texto cifrado; a nota aparece como bloqueada (cartão e página). "Unlock" decifra para edição e lembra a senha só em memória, com botão "Lock again". Testes de ida e volta e de senha errada.

## 14. Fechamento
> Atualizar README, AUDIT e testes; rodar tsc, eslint, vitest e cargo test; commit e push na `main`.
