import { createConnectTransport } from '@connectrpc/connect-web';
import { createPromiseClient } from '@connectrpc/connect';
import { ConnectionService } from '../gen/connection_connect';
import { QueryService } from '../gen/query_connect';
import { AIService } from '../gen/ai_connect';
import { MigrationService } from '../gen/migration_connect';
import { MetadataService } from '../gen/metadata_connect';

// Create transport for browser
// Uses relative URLs - works with Vite proxy in dev and same-origin server in prod
const transport = createConnectTransport({
  baseUrl: '',
  credentials: 'include', // Important: include cookies for auth
});

// Create typed clients
export const connectionClient = createPromiseClient(ConnectionService, transport);
export const queryClient = createPromiseClient(QueryService, transport);
export const aiClient = createPromiseClient(AIService, transport);
export const migrationClient = createPromiseClient(MigrationService, transport);
export const metadataClient = createPromiseClient(MetadataService, transport);
