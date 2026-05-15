# Web Matcha — Especificações do Projeto

> Projeto de aplicação web de namoro (dating app) com funcionalidades de matching, chat em tempo real e notificações.

---

## Sumário

- [IV.1 Registro e Login](#iv1-registro-e-login)
- [IV.2 Perfil do Usuário](#iv2-perfil-do-usuário)
- [IV.3 Navegação (Browsing)](#iv3-navegação-browsing)
- [IV.4 Pesquisa (Research)](#iv4-pesquisa-research)
- [IV.5 Visualização de Perfil](#iv5-visualização-de-perfil)
- [IV.6 Chat](#iv6-chat)
- [IV.7 Notificações](#iv7-notificações)
- [Segurança](#segurança)

---

## IV.1 Registro e Login

### Registro

- O app deve permitir que o usuário se registre fornecendo, no mínimo:
  - Endereço de e-mail
  - Username
  - Sobrenome
  - Primeiro nome
  - Senha protegida com segurança
- **Senhas fracas** (palavras comuns de dicionário, em qualquer idioma) **não devem ser aceitas**.
- Após o registro, o usuário deve receber um **e-mail com link único** para verificar a conta.

### Login

- Login via **username + senha**.
- Opção de **redefinição de senha** via e-mail caso o usuário esqueça.
- **Logout em um clique**, disponível em qualquer página do site.

---

## IV.2 Perfil do Usuário

Após o login, o usuário deve completar o perfil com:

- **Gênero**
- **Preferências sexuais**
- **Biografia**
- **Lista de interesses** via tags reutilizáveis (ex: `#vegan`, `#geek`, `#piercing`)
- **Até 5 fotos**, sendo uma designada como foto de perfil

### Funcionalidades adicionais

- Modificar essas informações a qualquer momento (incluindo nome, sobrenome e e-mail).
- Ver **quem visualizou** o perfil.
- Ver **quem "curtiu"** o perfil.
- Cada usuário possui uma **"fame rating" pública** (a definição é livre, desde que seja consistente).

### Localização GPS

- Localização via GPS até o nível de bairro, **com consentimento explícito** do usuário.
- Se o usuário recusar GPS, deve **inserir manualmente** a localização aproximada (cidade ou bairro).
- A localização manual é **obrigatória** para o funcionamento das features de matching.
- Possibilidade de **modificar a localização** a qualquer momento.

> 💡 **Nota GDPR:** A abordagem respeita os requisitos do GDPR sobre consentimento explícito para processamento de dados.

---

## IV.3 Navegação (Browsing)

Lista de **perfis sugeridos** baseada nas preferências do usuário.

### Regras de sugestão

- Perfis devem ser "interessantes" e respeitar orientação sexual:
  - Mulher hetero → apenas perfis masculinos.
  - Bissexualidade deve ser tratada corretamente.
  - Se a orientação não for especificada, considerar **bissexual por padrão**.

### Critérios de matching (inteligente, múltiplos critérios)

1. **Proximidade geográfica**
2. **Maior número de tags em comum**
3. **Maior "fame rating"**

> Prioridade para usuários da **mesma área geográfica**.

### Ordenação e filtragem

A lista deve ser ordenável e filtrável por:

- Idade
- Localização
- Fame rating
- Tags em comum

---

## IV.4 Pesquisa (Research)

Pesquisa avançada com um ou mais critérios:

- Faixa etária específica
- Faixa de fame rating
- Localização
- Uma ou mais tags de interesse

> Resultados devem ser **ordenáveis e filtráveis** pelos mesmos critérios da lista de sugestões.

---

## IV.5 Visualização de Perfil

Usuários podem ver perfis de outros usuários — exceto **e-mail** e **senha**.

Cada visualização é registrada no **histórico de visitas** do usuário visualizado.

### Ações possíveis ao visualizar um perfil

| Ação                | Descrição                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **Like**            | Curtir a foto de perfil. Match mútuo = conexão + chat liberado. _Requer foto de perfil._ |
| **Unlike**          | Remover um like anterior. Desativa notificações e o chat com aquele usuário.             |
| **Ver fame rating** | Conferir a reputação pública do perfil.                                                  |
| **Status online**   | Ver se o usuário está online ou a data/hora da última conexão.                           |
| **Reportar**        | Reportar como "conta falsa".                                                             |
| **Bloquear**        | Bloqueado some das buscas, notificações e chat.                                          |

> O usuário deve **ver claramente** se o perfil visualizado já o curtiu ou se já estão conectados, e ter a opção de descurtir/desconectar.

---

## IV.6 Chat

- Quando dois usuários estão **conectados** (like mútuo), eles devem poder conversar em **tempo real**.
- Implementação livre, mas:
  - **Delay máximo: 10 segundos**
  - O usuário deve ver, **de qualquer página**, quando recebe uma nova mensagem.

---

## IV.7 Notificações

Notificações em **tempo real** (delay máximo de 10 segundos) para:

- 💖 Receber um like
- 👀 Perfil visualizado
- ✉️ Nova mensagem recebida
- 🎉 Match mútuo (quem você curtiu te curtiu de volta)
- 💔 Um usuário conectado removeu o like

> O usuário deve ver, **de qualquer página**, quando há notificações não lidas.

---

## Segurança

> ⚠️ **IMPORTANTE**
>
> Por razões de segurança, **todas as credenciais, chaves de API, variáveis de ambiente, etc.** devem ser armazenadas localmente em um arquivo `.env` e **excluídas do Git**.
>
> Armazenar credenciais publicamente pode resultar em **falha do projeto**.

---

## Checklist Rápido de Implementação

- [ ] Sistema de registro com validação de senha forte
- [ ] Verificação de e-mail por link único
- [ ] Login, logout e reset de senha
- [ ] Completar perfil (gênero, orientação, bio, tags, fotos)
- [ ] Histórico de visitas e likes recebidos
- [ ] Cálculo de fame rating
- [ ] Geolocalização (GPS + fallback manual)
- [ ] Algoritmo de sugestão de perfis
- [ ] Filtros e ordenação (idade, localização, fame, tags)
- [ ] Pesquisa avançada
- [ ] Visualização de perfil com ações (like, block, report)
- [ ] Chat em tempo real (≤ 10s)
- [ ] Notificações em tempo real (≤ 10s)
- [ ] `.env` configurado e fora do Git
