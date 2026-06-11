# Contributing to AuraOS

Thank you for your interest in contributing to AuraOS! This document outlines the process for contributing to the project.

## Table of Contents

- [Project Overview](#project-overview)
- [Code of Conduct](#code-of-conduct)
- [Development Setup](#development-setup)
- [Development Commands](#development-commands)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Commit Style](#commit-style)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Reporting Issues](#reporting-issues)
- [Security](#security)

---

## Project Overview

AuraOS is a **multi-tenant restaurant POS platform** built with:

- **Backend**: Node.js 18+ / TypeScript / Express 4 / PostgreSQL 15
- **Frontend**: React 18 / TypeScript / Vite / Tailwind CSS 3
- **Real-time**: Socket.io 4 for kitchen display
- **Architecture**: Repository pattern (Route → Controller → Service → Repository → PostgreSQL)
- **Database**: Raw SQL with parameterized queries via `pg` driver (no ORM)

The platform supports 6 restaurant types (Full Service, QSR Simple, QSR Chain, Café, Cloud Kitchen, Hybrid) with 8 toggleable features per restaurant.

---

## Code of Conduct

- Be respectful and inclusive in all interactions
- Provide constructive feedback in code reviews
- Focus on the technical merits of changes
- Keep discussions relevant to the project

---

## Development Setup

### Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 18+ | `node -v` |
| npm | 9+ | `npm -v` |
| PostgreSQL | 14+ | `psql --version` |

### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/auraos.git
cd auraos

# Start PostgreSQL via Docker (optional)
docker compose up -d

# Install dependencies
npm install
cd client && npm install && cd ..
cd apps/waiter && npm install && cd ../..

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Run migrations (seeds demo data)
npm run migrate

# Start all services (3 terminals)
npm run dev                         # Terminal 1: Backend (port 3000)
cd client && npm run dev            # Terminal 2: Staff Portal (port 3001)
cd apps/waiter && npm run dev       # Terminal 3: Waiter App (port 3002)
```

### Demo Access

After running migrations, log in at `http://localhost:3001`:

```
Email:    admin@demo-kitchen.local
Password: demo123
```

---

## Development Commands

### Backend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend with ts-node + file watching |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm test` | Run backend tests (Jest + Supertest) |
| `npm run migrate` | Run all SQL migrations in order |
| `npm run lint` | Lint TypeScript files |

### Frontend (Staff Portal)

| Command | Description |
|---------|-------------|
| `cd client && npm run dev` | Start Vite dev server (port 3001) |
| `cd client && npm run build` | Production build to `client/dist/` |
| `cd client && npm test` | Run frontend tests (Vitest) |

### Waiter App

| Command | Description |
|---------|-------------|
| `cd apps/waiter && npm run dev` | Start Vite dev server (port 3002) |
| `cd apps/waiter && npm run build` | Production build |

---

## Project Structure

```
auraos/
├── src/                          # Backend source
│   ├── app.ts                    # Express app setup
│   ├── server.ts                 # HTTP server, Socket.io, graceful shutdown
│   ├── config/                   # Database, env, email, payments config
│   ├── modules/                  # Feature modules (auth, orders, menu, etc.)
│   │   ├── <module>/
│   │   │   ├── <module>.routes.ts      # Endpoint definitions + middleware
│   │   │   ├── <module>.controller.ts  # Request/response handling
│   │   │   ├── <module>.service.ts     # Business logic
│   │   │   ├── <module>.repository.ts  # Raw SQL queries
│   │   │   └── <module>.types.ts       # TypeScript interfaces
│   ├── integrations/             # Zomato, WhatsApp webhook handlers
│   └── shared/                   # Middleware, errors, jobs, monitoring
├── client/                       # Staff Portal (React PWA)
│   └── src/
│       ├── pages/                # Page components
│       ├── components/           # Reusable UI components
│       ├── contexts/             # Auth, Features, Socket contexts
│       └── config/               # Restaurant type definitions
├── apps/waiter/                  # Waiter App (React PWA)
├── migrations/                   # SQL migration files (001-020)
├── scripts/                      # Utility scripts (migrate, backup, seed)
└── docs/                         # Documentation and screenshots
```

---

## Coding Standards

### TypeScript

- Use **strict mode** — no implicit `any`
- Prefer `interface` over `type` for object shapes
- Use `const` by default, `let` only when reassignment is needed
- Async/await over raw promises
- Export named functions/classes, not default exports (except React components)

### Backend

- **Repository Pattern**: Every module follows Route → Controller → Service → Repository
- **Raw SQL**: All queries in repository files, use `$1, $2, ...` parameterized placeholders
- **Validation**: Use Zod schemas in route files, not controllers
- **Error Handling**: Throw typed errors (`AppError`, `NotFoundError`, `ValidationError`) from services
- **Naming**: `camelCase` for variables, `PascalCase` for classes, `UPPER_SNAKE_CASE` for constants

### Frontend

- **Components**: Functional components with hooks, no class components
- **State**: React Context for global state (auth, features, socket), local `useState` for component state
- **Styling**: Tailwind utility classes only, no custom CSS files
- **API Calls**: Use the Axios client from `src/api.ts`, which handles token refresh automatically
- **File Naming**: `PascalCase.tsx` for components, `camelCase.ts` for utilities

### SQL

- **Migrations**: One file per migration, numbered sequentially (`001_enums.sql`, `002_core.sql`, ...)
- **Naming**: `snake_case` for tables and columns
- **References**: Always use foreign key constraints with `ON DELETE CASCADE` where appropriate
- **Indexes**: Add indexes for columns used in `WHERE`, `JOIN`, and `ORDER BY` clauses

---

## Commit Style

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`

**Examples**:

```
feat(orders): add daily token number auto-increment
fix(menu): resolve category slug collision on rename
docs(readme): add architecture diagrams section
refactor(auth): extract token logic to service layer
test(orders): add integration tests for status pipeline
```

---

## Pull Request Guidelines

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Keep changes focused** — one feature/fix per PR

3. **Write clear commit messages** following the commit style above

4. **Add tests** for new features or bug fixes:
   - Backend: Jest + Supertest in `src/__tests__/`
   - Frontend: Vitest + Testing Library in `client/src/test/`

5. **Run existing tests** before submitting:
   ```bash
   npm test
   cd client && npm test
   ```

6. **Update documentation** if your change affects:
   - Environment variables → update `.env.example`
   - API endpoints → update relevant API docs
   - Setup/installation → update `README.md`
   - Screenshots → add images to `docs/screenshots/`

7. **Describe your changes** in the PR description:
   - What problem does it solve?
   - How was it implemented?
   - What testing was done?
   - Any breaking changes?

8. **Request review** from a maintainer

---

## Reporting Issues

When reporting bugs, include:

- **AuraOS version** (git commit hash)
- **Node.js and PostgreSQL versions**
- **Steps to reproduce** the issue
- **Expected behavior** vs **actual behavior**
- **Error messages** and stack traces
- **Screenshots** if applicable

Use the GitHub Issues tab and select the appropriate template.

---

## Security

- **Never commit secrets** — `.env`, API keys, passwords, or tokens
- **Use environment variables** for all sensitive configuration
- **Report vulnerabilities privately** — do not open public issues for security bugs
- **All database queries** must use parameterized placeholders (`$1, $2, ...`) — never string interpolation
- **Validate all inputs** with Zod schemas in route files

---

## License

By contributing to AuraOS, you agree that your contributions will be licensed under the [MIT License](LICENSE).