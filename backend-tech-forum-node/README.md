# Tech Forum Backend — Node.js + PostgreSQL

Replacement for the original Strapi v4 backend. It uses **Node.js, Express and PostgreSQL** and keeps the main API resources and endpoint names used by the Strapi project:

- `users` and local authentication
- `thread-sets` (forum categories)
- `threads` (forum topics)
- `responses` (replies)
- image uploads and profile pictures

The REST API returns flattened JSON objects, consistent with the original project's Strapi Transformer configuration (`removeDataKey` / `removeAttributesKey`). Request bodies may be sent as either `{ "title": "..." }` or Strapi-style `{ "data": { "title": "..." } }`.

> This replaces the **content API**, not Strapi's administrative dashboard. There is no Strapi Admin UI in this project.

## 1. Requirements

- Node.js 20 or newer
- Docker and Docker Compose, or a running PostgreSQL instance
- npm

## 2. Start PostgreSQL

From this directory, run:

```bash
docker compose up -d postgres
```

The provided Compose file creates a database called `tech_forum` with user `tech_forum` and password `change_me`. Change these credentials before using the project outside a local development environment.

## 3. Configure and run the API

```bash
cp .env.example .env
```

Edit `.env` and set `JWT_SECRET` to a long, random value. Then run:

```bash
npm install
npm run dev
```

The API listens at `http://localhost:1337`. `npm run dev` creates/updates the schema before starting the server. To run without file watching, use `npm start`.

Useful checks:

```bash
curl http://localhost:1337/health
curl http://localhost:1337/api/thread-sets
curl http://localhost:1337/api/threads
```

The existing image assets from the Strapi project are included under `public/uploads` and are served at URLs such as `http://localhost:1337/uploads/guts_b8ef490bb3.webp`.

## 4. API endpoints

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/local/register` | Public | Register using `username`, `email`, `password` |
| `POST` | `/api/auth/local` | Public | Login with `identifier` (username or email) and `password` |
| `GET` | `/api/users/me` | Bearer JWT | Get the current user's profile |
| `PATCH` | `/api/users/me` | Bearer JWT | Update the current profile, password, or image |
| `GET` | `/api/users` | Public | List public profiles |
| `GET` | `/api/users/:id` | Public | Get one public profile |
| `GET` | `/api/thread-sets` | Public | List categories |
| `GET` | `/api/thread-sets/:id` | Public | Get a category |
| `POST` / `PATCH` / `DELETE` | `/api/thread-sets[/:id]` | Bearer JWT | Manage categories |
| `GET` | `/api/threads` | Public | List topics, including author, category and replies |
| `GET` | `/api/threads/:id` | Public | Get one topic |
| `POST` / `PATCH` / `DELETE` | `/api/threads[/:id]` | Bearer JWT | Create or manage your own topics |
| `GET` | `/api/responses` | Public | List replies |
| `GET` | `/api/responses/:id` | Public | Get one reply |
| `POST` / `PATCH` / `DELETE` | `/api/responses[/:id]` | Bearer JWT | Create or manage your own replies |
| `POST` | `/api/upload` | Bearer JWT | Upload up to five profile images (`multipart/form-data`, field `files`) |
| `DELETE` | `/api/upload/:id` | Bearer JWT | Delete your own upload |

All public reads are unauthenticated. Creating content requires a JWT. Users can edit/delete only their own threads and replies; category management requires a JWT. Passwords and authentication tokens are never included in public profile responses.

### Register

```bash
curl -X POST http://localhost:1337/api/auth/local/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"gurgel","email":"gurgel@example.com","password":"a-strong-password"}'
```

The response contains a `jwt` token and a public `user` object. Use the token for protected routes:

```bash
curl http://localhost:1337/api/users/me \
  -H 'Authorization: Bearer YOUR_JWT'
```

### Create a category

```bash
curl -X POST http://localhost:1337/api/thread-sets \
  -H 'Authorization: Bearer YOUR_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Game Development","description":"Game development topics"}'
```

### Create a topic

Pass the category ID using `thread_set`, `threadSetId`, or `thread_set_id`:

```bash
curl -X POST http://localhost:1337/api/threads \
  -H 'Authorization: Bearer YOUR_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"title":"How do I build a Godot enemy AI?","thread_set":{"id":1}}'
```

### Reply to a topic

```bash
curl -X POST http://localhost:1337/api/responses \
  -H 'Authorization: Bearer YOUR_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"content":"You can use a RayCast2D for line-of-sight checks.","thread":{"id":1}}'
```

### Upload a profile image

```bash
curl -X POST http://localhost:1337/api/upload \
  -H 'Authorization: Bearer YOUR_JWT' \
  -F 'files=@./avatar.png'
```

The response is an array of upload objects. Send the returned upload `id` in the profile update:

```bash
curl -X PATCH http://localhost:1337/api/users/me \
  -H 'Authorization: Bearer YOUR_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"image":1}'
```

## 5. Query filters and sorting

The common Strapi query-string forms below are supported:

```text
GET /api/threads?filters[title][$containsi]=godot
GET /api/threads?filters[thread_set][id][$eq]=1
GET /api/threads?filters[isFixed][$eq]=true
GET /api/threads?sort=createdAt:desc&pagination[page]=1&pagination[pageSize]=20
GET /api/responses?filters[thread][id][$eq]=1
GET /api/thread-sets?sort=name:asc
```

The collection response is a JSON array of flattened objects. The API supports pagination controls up to 100 rows per request. Unknown sort fields are ignored and replaced with a safe default.

## 6. Import existing Strapi data (optional)

The old Strapi project uses SQLite at `.tmp/data.db`. If you want to transfer its existing users, categories, topics, replies and media metadata into PostgreSQL:

1. Keep the old Strapi project/database available. Do **not** delete or overwrite its `.tmp/data.db`.
2. From this backend directory, install dependencies and run the schema migration:

   ```bash
   npm install
   npm run db:migrate
   ```

3. Point the importer at the old database and run it:

   ```bash
   LEGACY_SQLITE_PATH=../Back_End_Tech_Forum/.tmp/data.db npm run db:import-strapi
   ```

The path is relative to this project's directory (or it can be an absolute path). The importer preserves IDs and password hashes and avoids overwriting rows already in PostgreSQL. Test this against a backup first. The image files included in `public/uploads` are copied from the uploaded Strapi project; if your production database refers to other upload files, copy those files too.

## 7. Notes and assumptions

- The old schemas declare some user/category/thread relationships as `oneToOne`, but the old SQLite database stores multiple topics per user and multiple replies per topic. This backend follows the actual forum behavior: one user can create many topics, and one topic can have many replies.
- New categories, topics and replies are published immediately. Draft/publication workflows from the Strapi Admin UI are not reproduced.
- `isFixed` is preserved and fixed topics are shown first. The project does not contain a separate moderator/role system, so this backend does not implement admin-only moderation.
- Image upload is restricted to common image formats and 5 MB by default. Change `UPLOAD_MAX_FILE_SIZE_MB` in `.env` to adjust it.
- Use HTTPS, a strong `JWT_SECRET`, restricted CORS origins and managed PostgreSQL credentials for production deployment.
