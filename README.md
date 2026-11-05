# Vanguarda da Luz — front-end

Site da guilda de World of Warcraft **Vanguarda da Luz**: Angular 22 (standalone, zoneless, TypeScript estrito), Firebase Authentication, Cloud Firestore e Firebase Hosting no plano Spark (sem Cloud Functions nem Storage).

Fontes de verdade: [`docs/criterios-de-aceite.md`](docs/criterios-de-aceite.md) e [`docs/prototipo.pdf`](docs/prototipo.pdf).

## Pré-requisitos

- Node.js 22+ e npm
- Java 21+ (para o emulador do Firestore)

```bash
npm install
```

## Desenvolvimento

Em dois terminais:

```bash
npm run emulators   # Auth :9099, Firestore :8080, Hosting :5050, Emulator UI :4000
npm start           # http://localhost:4200
```

Em desenvolvimento o app usa o projeto `demo-vanguarda-da-luz` e se conecta somente aos emuladores; nada vai para a nuvem. A Emulator UI (http://127.0.0.1:4000) mostra usuários e documentos.

No emulador, o "e-mail" de redefinição de senha não é enviado: o link aparece no terminal dos emuladores e aponta para a página do próprio emulador. Para abrir o link equivalente na página do app:

```bash
npm run dev:reset-link -- email@exemplo.com
```

Para popular os emuladores com dados de exemplo (um administrador e candidatos nos dois jogos; senha `segredo123`):

```bash
npm run dev:seed   # admin: maren@vanguarda.test
```

## Verificações

| Comando                  | O que faz                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `npm run lint`           | ESLint (TypeScript e templates, incluindo regras de acessibilidade)                                                      |
| `npm run test:ci`        | Testes de unidade (Vitest)                                                                                               |
| `npm run test:emulators` | Testes das Security Rules e dos fluxos Auth + Firestore, em emuladores próprios (`firebase.test.json`, portas 9199/8180) |
| `npm run build`          | Build de produção                                                                                                        |
| `npm run check`          | Tudo acima, em sequência                                                                                                 |

Os testes usam emuladores separados dos de desenvolvimento, então podem rodar com `npm run emulators` ligado sem apagar seus dados.

Para testar no navegador sem tocar nos dados de desenvolvimento, `npm run e2e:serve` gera um build apontando para os emuladores de teste e o serve em http://127.0.0.1:5150.

## Estrutura

```
src/app/
  core/        firebase, sessão e guards, conteúdo da guilda, rotas auxiliares
  layout/      cabeçalho (menu por perfil) e rodapé (redes sociais)
  features/    páginas, carregadas sob demanda (lazy loading)
src/styles/    design tokens e estilos globais
firestore.rules       Security Rules (negam tudo por padrão)
tests/rules/          testes das Security Rules
tests/integration/    fluxos contra os emuladores (cadastro, …)
```

Textos fixos da guilda ainda pendentes ficam entre colchetes em `src/app/core/content/guild-content.ts`. História, valores, facção, servidor no Retail, rulesets no WoW Forever e os links das redes sociais são editados no site, em **Administração > Guilda** e **Administração > Redes sociais** (documentos `site/guild` e `site/social` no Firestore). Até o primeiro salvamento, o rodapé usa os links oficiais definidos em `src/app/core/content/site-content.ts`, e a página inicial mostra somente a facção (Aliança) e os rulesets (Normal e JxJ).

## Produção

Projeto Firebase: `vanguarda-da-luz` (padrão em `.firebaserc`). A configuração do app web fica em `src/environments/environment.prod.ts`.

Configuração única no Console do Firebase, em **Authentication > Modelos > Redefinição de senha**:

1. Em **Personalizar URL de ação**, informe `https://vanguarda-da-luz.web.app/redefinir-senha` (ou o domínio próprio do site). Sem isso, o link abre a página padrão do Firebase, que aceita senhas com 6 caracteres em vez de 8. A mesma URL vale para os e-mails de troca de e-mail (confirmar o novo endereço e desfazer a troca): o app encaminha esses links para `/confirmar-email`.
2. Selecione o idioma **Português (Brasil)** no modelo de redefinição de senha e nos modelos de alteração de e-mail. O app já envia `pt-BR`.

### Primeiro administrador

O primeiro administrador é definido manualmente, uma única vez:

1. Cadastre-se pelo site normalmente e envie uma candidatura (ela vira o personagem principal).
2. No Console do Firebase, em **Firestore**, edite os documentos com o seu `uid`:
   - `users/{uid}`: `status` = `ativo` e `role` = `admin`;
   - `applications/{uid}`: `status` = `aprovada`;
   - crie `members/{uid}` com `username` (igual ao de `users`), `active` = `true`, `joinedAt` (data atual), `approvedBy` (o próprio `uid`) e o mapa `mainCharacter` com os campos de personagem da candidatura (`game`, `characterName`, `characterClass`, `characterRole` e `server` ou `characterSurname` + `ruleset`). O nível não entra aqui: depois, em **Minha conta**, edite o personagem principal e informe o nível.
   - crie `config/admins` com o campo `activeAdminUids` (array) contendo o seu `uid`. Essa lista guarda os administradores ativos e impede que a guilda fique sem nenhum.
3. Saia e entre novamente. O menu **Administração** aparece.
4. Em **Administração > Guilda**, escreva a história, os valores e o servidor no Retail.

A partir daí, novos membros e administradores são definidos pelo próprio site.
