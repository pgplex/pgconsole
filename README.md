> [!NOTE]
> pgplex: Modern Developer Stack for Postgres - **pgconsole** · [pgtui](https://github.com/pgplex/pgtui) · [pgschema](https://github.com/pgplex/pgschema) · [pgparser](https://github.com/pgplex/pgparser)

<p align="center">
  <a href="https://www.pgconsole.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/pgplex/pgconsole/main/src/assets/logo-dark-full.svg" />
      <img src="https://raw.githubusercontent.com/pgplex/pgconsole/main/src/assets/logo-light-full.svg" alt="pgconsole" />
    </picture>
  </a>
</p>

**pgconsole** is web-based PostgreSQL editor. Single binary, single config file, no database required. Connect your team to PostgreSQL with access control and audit logging built in.

## Features

- Full PostgreSQL parser powers realtime autocomplete, syntax highlighting, and error detection
- Query, edit results, stage changes, and apply — all in one view
- AI assistant generates SQL, explains queries, fixes errors, and assesses change risk
- Fine-grained IAM controls who can read, write, or administer each connection
- Every query and login is recorded in the audit log
- Everything is in `pgconsole.toml` — connections, users, groups, access rules, AI providers

## Installation

### Prerequisites

- Node.js 20+

### npm

```bash
npm install -g @pgplex/pgconsole
pgconsole --config pgconsole.toml
```

### npx

```bash
npx @pgplex/pgconsole --config pgconsole.toml
```

### Docker

```bash
docker run -p 9876:9876 -v /path/to/pgconsole.toml:/etc/pgconsole.toml pgplex/pgconsole
```
