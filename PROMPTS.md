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

1. **Login** pelo Device Flow: código no app, autorização no navegador, token no chaveiro do sistema.
2. **Ligar a pasta a um repositório**: criar novo, escolher um existente ou colar a URL.
3. **Motor de sincronização** com `git2`: commit automático, `fetch` periódico, `push`.
4. **Conflitos**: merge de texto por linha; tela com "minha", "do outro" ou "as duas"; merge por card no `board.json`.
5. **Interface**: ícone de status no cabeçalho, painel de sincronização, aviso ao editar.
6. **Testes e documentação**.

Tudo desligado por padrão: sem conectar, o app não faz nenhuma chamada de rede.
