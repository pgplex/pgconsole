import { describe, it, expect } from 'vitest'
import { loadConfigFromString } from '../server/lib/config'
import { getConnections } from '../server/lib/config'

describe('schema_source config parsing', () => {
  it('parses connection without schema_source', async () => {
    await loadConfigFromString(`
[[connections]]
id = "local"
name = "Local"
host = "localhost"
port = 5432
database = "postgres"
username = "postgres"
`)
    const conns = getConnections()
    expect(conns[0].schema_source).toBeUndefined()
  })

  it('parses connection with full schema_source', async () => {
    await loadConfigFromString(`
[[connections]]
id = "staging"
name = "Staging"
host = "staging.example.com"
port = 5432
database = "myapp"
username = "app_user"

[connections.schema_source]
repo = "https://github.com/myorg/db-schema.git"
branch = "main"
path = "schema/main.sql"
schema = "public"
`)
    const conns = getConnections()
    expect(conns[0].schema_source).toEqual({
      repo: 'https://github.com/myorg/db-schema.git',
      branch: 'main',
      path: 'schema/main.sql',
      schema: 'public',
    })
  })

  it('defaults branch to undefined and schema to public', async () => {
    await loadConfigFromString(`
[[connections]]
id = "staging"
name = "Staging"
host = "staging.example.com"
port = 5432
database = "myapp"
username = "app_user"

[connections.schema_source]
repo = "https://github.com/myorg/db-schema.git"
path = "schema/main.sql"
`)
    const conns = getConnections()
    expect(conns[0].schema_source).toEqual({
      repo: 'https://github.com/myorg/db-schema.git',
      branch: undefined,
      path: 'schema/main.sql',
      schema: 'public',
    })
  })

  it('throws when schema_source.repo is missing', async () => {
    await expect(loadConfigFromString(`
[[connections]]
id = "staging"
name = "Staging"
host = "staging.example.com"
port = 5432
database = "myapp"
username = "app_user"

[connections.schema_source]
path = "schema/main.sql"
`)).rejects.toThrow('schema_source.repo')
  })

  it('throws when schema_source.path is missing', async () => {
    await expect(loadConfigFromString(`
[[connections]]
id = "staging"
name = "Staging"
host = "staging.example.com"
port = 5432
database = "myapp"
username = "app_user"

[connections.schema_source]
repo = "https://github.com/myorg/db-schema.git"
`)).rejects.toThrow('schema_source.path')
  })
})
