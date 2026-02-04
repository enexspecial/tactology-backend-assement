# Tact Assessment Backend

A GraphQL API built with NestJS for user authentication and file upload management. Features include JWT-based auth, file storage via MinIO, paginated file listings, upload metrics, and real-time subscriptions.

**Tech Stack:** NestJS 11, Apollo GraphQL (code-first), TypeORM, PostgreSQL, MinIO, Passport JWT, Throttler, graphql-ws

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 16+
- MinIO (or use Docker)

### Environment Variables

Create a `.env` file in the project root:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=tact_assessment
JWT_SECRET=your-secret-key-here
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=fileuploads
```

**Required variables:** `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`. Missing required vars will cause startup errors.

### Local Development

```bash
# Install dependencies
npm install

# Start PostgreSQL and MinIO (if not using Docker)
# Or use Docker Compose (see below)

# Run migrations
npm run build
npx typeorm migration:run -d dist/config/typeormConfig.js

# Start development server
npm run start:dev
```

GraphQL Playground available at `http://localhost:3000/graphql`

### Docker Compose (Optional)

Run all services with Docker:

```bash
# Ensure JWT_SECRET is set in .env
docker compose up -d
```

This starts:
- PostgreSQL on port 5432
- MinIO on ports 9000 (API) and 9001 (Console)
- NestJS app on port 8062 (mapped from container port 3000)

To run only dependencies and develop locally:

```bash
docker compose up -d postgres minio
# Then run npm run start:dev locally
```

---

## API Overview

### Authentication

- **`signUp(createAuthInput: CreateAuthInput!)`** - Register a new user
  - Input: `{ email: String!, password: String! }`
  - Returns: `User` object

- **`signIn(loginInput: CreateAuthInput!)`** - Authenticate and get JWT token
  - Input: `{ email: String!, password: String! }`
  - Returns: `{ token: String!, user: User! }`

- **`me`** - Get current authenticated user (requires JWT)
  - Returns: `User` object

### File Operations

- **`uploadFile(input: FileUploadInput!)`** - Upload a file (requires JWT, rate limited)
  - Input: `{ file: Upload! }` (multipart, max 10MB)
  - Returns: `Fileupload` metadata

- **`myFiles(pagination: PaginationInput)`** - Get paginated list of user's files (requires JWT)
  - Optional pagination: `{ page: Int = 1, limit: Int = 10 }`
  - Returns: `PaginatedFiles` with data, total, page info

- **`myUploadMetrics`** - Get upload statistics (requires JWT)
  - Returns: `{ totalFiles: Int!, totalStorage: Int!, uploadsPerDay: [UploadsPerDay!]! }`

### Subscriptions

- **`fileUploaded`** - Real-time notification when a file is uploaded (requires JWT)
  - Returns: `Fileupload` object
  - **Note:** Only the user who uploaded the file receives the event

### Authentication Headers

For protected operations, include the JWT token:

```
Authorization: Bearer <token>
```

For GraphQL subscriptions, send the JWT in connection params:

```javascript
{
  connectionParams: {
    authorization: `Bearer ${token}`
  }
}
```

---

## Architecture Decisions

### Code-First GraphQL

Chose NestJS's code-first approach over schema-first for:
- **Type safety:** TypeScript decorators ensure compile-time validation
- **Single source of truth:** Entities, DTOs, and GraphQL types are co-located
- **Developer experience:** Auto-generated schema reduces boilerplate
- **Refactoring:** TypeScript compiler catches breaking changes

### NestJS Framework

Selected NestJS because:
- **Modular architecture:** Clear separation of concerns (modules, services, resolvers)
- **Dependency injection:** Testable, maintainable code structure
- **Built-in GraphQL support:** Apollo integration with minimal configuration
- **Guards & interceptors:** Clean authentication and authorization patterns

### PostgreSQL + MinIO Separation

**PostgreSQL** stores:
- User accounts and authentication data
- File metadata (filename, size, mimeType, objectKey, timestamps)
- Relationships between users and files

**MinIO** stores:
- Actual file binaries (object storage)
- S3-compatible API for future scalability

**Rationale:** Separating metadata from storage allows:
- Independent scaling of database and storage
- Easy migration to cloud storage (AWS S3, GCS) later
- Efficient metadata queries without loading file contents

### In-Memory PubSub for Subscriptions

Currently using `graphql-subscriptions` PubSub (in-memory):
- **Simple:** No external dependencies for development
- **Fast:** Low latency for real-time updates
- **Limitation:** Doesn't scale horizontally (single instance only)

**Trade-off:** Acceptable for MVP; production would need Redis PubSub for multi-instance deployments.

### User-Based Rate Limiting

Implemented `UserThrottlerGuard` that throttles by user ID rather than IP:
- **Fair:** Prevents single user from monopolizing resources
- **Resilient:** Works behind load balancers/proxies
- **Context-aware:** Uses authenticated user ID when available, falls back to IP

---

## Authentication Flow

### JWT Strategy

1. **Sign Up:** User provides email/password → password hashed with bcrypt (10 rounds) → user saved to PostgreSQL
2. **Sign In:** Email/password validated → bcrypt comparison → JWT token issued (7-day expiry)
3. **Protected Routes:** `JwtAuthGuard` extracts token from `Authorization` header → Passport JWT strategy validates → user loaded from DB → attached to request context

### Implementation Details

- **Password Security:** bcrypt with salt rounds = 10
- **Token Payload:** `{ sub: userId, email }` (standard JWT claims)
- **Token Storage:** Client-side (localStorage in frontend example)
- **Guard Pattern:** `@UseGuards(JwtAuthGuard)` on resolvers
- **User Context:** `@CurrentUser()` decorator extracts authenticated user from request

### GraphQL Context

The GraphQL context includes the Express request object, allowing guards to access headers:

```typescript
context: ({ req }) => ({ req })
```

This enables JWT extraction in both queries/mutations and subscriptions.

---

## File Uploads & Subscriptions

### File Upload Flow

1. **Client sends multipart request** with file using GraphQL multipart request spec
2. **`graphql-upload` middleware** processes the stream (max 10MB, 1 file)
3. **Resolver receives Promise<FileUpload>** - stream is buffered into memory
4. **File uploaded to MinIO** with unique object key (`timestamp-filename`)
5. **Metadata saved to PostgreSQL** (userId, fileName, objectKey, size, mimeType)
6. **PubSub event published** with file data and userId
7. **Response returned** with Fileupload entity

### Subscription Flow

1. **Client connects** via `graphql-ws` protocol with JWT in connection params
2. **`onConnect` handler** extracts JWT from connection params and validates
3. **User context attached** to subscription context
4. **Filter function** ensures only the uploader receives their own events:
   ```typescript
   filter: (payload, variables, context) =>
     payload.fileUploaded.userId === context.req.user.id
   ```
5. **PubSub asyncIterator** streams events to subscribed clients

### Current Limitations

- **In-memory buffering:** Files are fully loaded into memory before upload (not ideal for large files)
- **Single-instance PubSub:** Subscriptions won't work across multiple server instances
- **No file validation:** MIME type and file extension not validated
- **No cleanup:** Deleted file records don't remove MinIO objects

---

## Trade-offs Made

### 1. In-Memory File Buffering vs Streaming

**Chosen:** Buffer entire file in memory before uploading to MinIO

**Why:** Simpler implementation, works for 10MB limit

**Trade-off:** Not suitable for larger files; would need streaming for production

### 2. In-Memory PubSub vs Redis

**Chosen:** In-memory PubSub for MVP

**Why:** Zero external dependencies, faster local development

**Trade-off:** Doesn't scale horizontally; would need Redis for production

### 3. Code-First vs Schema-First GraphQL

**Chosen:** Code-first with auto-generated schema

**Why:** Better TypeScript integration, less duplication

**Trade-off:** Schema file is generated (not human-editable), but acceptable for this use case

### 4. User-Based vs IP-Based Rate Limiting

**Chosen:** User-based throttling (10 requests/minute per user)

**Why:** More fair, works behind proxies, prevents user abuse

**Trade-off:** Requires authentication; anonymous users fall back to IP-based

### 5. Soft Deletes vs Hard Deletes

**Chosen:** Soft deletes (deletedAt column)

**Why:** Data retention, audit trail, easier recovery

**Trade-off:** Requires cleanup jobs; queries need filtering

### 6. Single Bucket vs Multi-Bucket

**Chosen:** Single MinIO bucket for all files

**Why:** Simpler configuration, sufficient for MVP

**Trade-off:** No automatic organization; would benefit from bucket-per-user or bucket-per-tenant

---

## What I'd Improve with More Time

### 1. **Production-Ready File Handling**
   - Stream files directly to MinIO instead of buffering in memory
   - Add file type validation (whitelist extensions/MIME types)
   - Implement virus scanning for uploads
   - Add file cleanup job for soft-deleted records

### 2. **Scalable Subscriptions**
   - Replace in-memory PubSub with Redis PubSub
   - Support horizontal scaling across multiple instances
   - Add subscription connection management and reconnection logic

### 3. **Enhanced Security**
   - Add rate limiting per endpoint (different limits for upload vs queries)
   - Implement refresh tokens for longer sessions
   - Add email verification for sign-ups
   - Implement password reset flow
   - Add request logging and monitoring

### 4. **Performance Optimizations**
   - Add database indexes on frequently queried fields (userId, createdAt)
   - Implement GraphQL DataLoader for N+1 query prevention
   - Add Redis caching for user lookups and metrics
   - Optimize metrics query (currently loads all files into memory)

### 5. **Developer Experience**
   - Add comprehensive error handling with proper GraphQL error types
   - Implement request/response logging middleware
   - Add API documentation (GraphQL schema documentation)
   - Create integration tests for file upload flow
   - Add health check endpoints

### 6. **Features**
   - File download endpoints with presigned URLs
   - File sharing/permissions system
   - File versioning
   - Batch file operations
   - Advanced filtering and search for file listings
   - File preview generation (thumbnails, PDF pages)

### 7. **Infrastructure**
   - Add CI/CD pipeline
   - Docker image optimization (multi-stage builds)
   - Environment-specific configurations
   - Monitoring and alerting (Prometheus, Grafana)
   - Structured logging (Winston/Pino)

### 8. **Testing**
   - Increase unit test coverage (currently basic coverage exists)
   - Add E2E tests for authentication flow
   - Add integration tests for file upload/subscription flow
   - Performance/load testing

---

## Migrations

Migrations are located in `src/migrations/`. Build the project first so migrations end up in `dist/migrations/` for the TypeORM CLI.

### Generate Migration

```bash
npm run build
npx typeorm migration:generate src/migrations/YourMigrationName -d dist/config/typeormConfig.js
```

### Run Migrations

```bash
npm run build
npx typeorm migration:run -d dist/config/typeormConfig.js
```

### Revert Migration

```bash
npx typeorm migration:revert -d dist/config/typeormConfig.js
```

**Note:** If you get "No migrations are pending" but expect new tables, ensure you've run `npm run build` after adding/editing migrations.

---

## Scripts

- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run start:dev` - Start development server with watch mode
- `npm run start:debug` - Start with debugger
- `npm run start:prod` - Start production server (after build)
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:cov` - Run tests with coverage
- `npm run test:e2e` - Run end-to-end tests

---