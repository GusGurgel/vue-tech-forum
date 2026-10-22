# Tech Forum — Backend

API REST do projeto **Tech Forum**, preparada para o frontend em Vue, Axios e Pinia enviado para análise. A API foi feita com Node.js, Express, Prisma ORM e SQLite, e mantém os caminhos e os formatos de resposta esperados pelas chamadas do frontend (incluindo o formato `{ "data": ... }` usado nas rotas de threads, respostas e categorias).

## Requisitos

- Node.js 20 ou superior
- npm

## Executar localmente

1. Entre na pasta do backend e instale as dependências:

   ```bash
   npm install
   ```

2. Crie o arquivo `.env` copiando o exemplo:

   ```bash
   cp .env.example .env
   ```

   Ajuste `JWT_SECRET` para um valor aleatório e troque a senha de administrador em `ADMIN_PASSWORD`. O frontend citado nas requisições usa `http://localhost:1337`, então essa é a porta padrão da API. Caso seu frontend rode em outra origem, ajuste `FRONTEND_ORIGIN`.

3. Crie o banco SQLite e gere o Prisma Client:

   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

4. Crie a conta administrativa configurada no `.env`:

   ```bash
   npm run db:seed
   ```

   O seed promove a conta informada em `ADMIN_EMAIL` a administradora, ou cria essa conta caso ainda não exista.

5. Inicie o backend:

   ```bash
   npm run dev
   ```

   A API estará em `http://localhost:1337`. Para conferir se está ativa, abra `http://localhost:1337/health`.

## Scripts úteis

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Inicia o servidor com reinicialização automática |
| `npm start` | Inicia o servidor normalmente |
| `npm run db:migrate` | Executa migrações locais do Prisma |
| `npm run db:deploy` | Aplica migrações existentes, recomendado para deploy |
| `npm run db:seed` | Cria/promove a conta administrativa configurada no `.env` |
| `npm run db:studio` | Abre a interface visual do banco pelo Prisma Studio |

## Rotas implementadas

### Autenticação e usuários

| Método | Endpoint | Acesso |
| --- | --- | --- |
| `POST` | `/auth/local/register` | Público |
| `POST` | `/auth/local` | Público |
| `GET` | `/users/me` | Autenticado |
| `GET` | `/users` | Administrador |
| `GET` | `/users/:id` | Próprio usuário ou administrador |
| `PUT` | `/users/:id` | Próprio usuário ou administrador; bloqueio e mudança de papel só por administrador |

O login retorna `{ jwt, user }`. O perfil `/users/me` retorna o objeto de usuário diretamente, com `role.type` igual a `admin` ou `authenticated`, como o frontend espera. As rotas administrativas de usuário retornam uma lista JSON direta em `GET /users`, compatível com `UsersContainer.vue`.

### Thread sets, threads e respostas

| Método | Endpoint | Acesso |
| --- | --- | --- |
| `GET` | `/thread-sets` e `/thread-sets/:id` | Público |
| `POST`, `PUT`, `DELETE` | `/thread-sets` e `/thread-sets/:id` | Administrador |
| `GET` | `/threads` e `/threads/:id` | Público |
| `POST` | `/threads` | Autenticado |
| `PUT`, `DELETE` | `/threads/:id` | Autor ou administrador (fixar tópico somente administrador) |
| `GET` | `/responses` e `/responses/:id` | Público |
| `POST` | `/responses` | Autenticado |
| `PUT`, `DELETE` | `/responses/:id` | Autor ou administrador |

As listagens aceitam os filtros usados pelo frontend, incluindo `filters[thread][id][$eq]` e `filters[thread_set][id][$eq]`. Também aceitam parâmetros `sort` e `pagination[limit]`. As respostas das coleções seguem `{ data: [...], meta: { pagination: ... } }`; recursos individuais seguem `{ data: {...}, meta: {} }`.

Para manter compatibilidade com formulários `FormData`, os endpoints de criação/edição aceitam tanto JSON normal quanto o campo multipart `data` contendo uma string JSON. A criação de resposta aceita o conteúdo no campo `content`, `body` ou `text`.

### Uploads

| Método | Endpoint | Acesso |
| --- | --- | --- |
| `POST` | `/upload` | Autenticado, campo multipart `files` |
| `DELETE` | `/upload/files/:id` | Autenticado |

O upload retorna uma lista de imagens com `id` e `url`, como o frontend utiliza. Arquivos de perfil ficam em `uploads/` e são servidos por `/uploads/<arquivo>`. São aceitas imagens JPEG, PNG, WEBP e GIF de até 5 MB por arquivo.

## Compatibilidade observada no frontend

- A API usa porta `1337` por padrão, igual à URL local usada pelo projeto.
- As rotas `/auth/local`, `/auth/local/register`, `/users/me`, `/users/:id`, `/upload`, `/thread-sets`, `/threads` e `/responses` estão implementadas.
- Os campos relacionais são expostos como `thread_set`, `author`, `thread` e `image` para acompanhar os objetos usados nos componentes Vue.
- IDs de autor enviados pelo frontend não são confiados: a API usa o usuário validado pelo token JWT.
- Threads e respostas são removidas automaticamente quando a categoria ou a thread pai é excluída.

**Nota:** o ZIP recebido contém os componentes e páginas listados nele, mas não inclui todos os componentes auxiliares, como os formulários/entradas completos de resposta, o módulo Axios `api`, nem o schema TypeScript. Por isso, a API aceita aliases comuns para o conteúdo da resposta; se um dos arquivos ausentes usar um nome de campo diferente, será necessário conferir essa chamada específica.
