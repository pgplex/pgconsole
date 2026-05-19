import { expressConnectMiddleware } from "@connectrpc/connect-express";
import type { Interceptor } from "@connectrpc/connect";
import type { Request } from "express";
import { ConnectionService } from "../src/gen/connection_connect";
import { QueryService } from "../src/gen/query_connect";
import { AIService } from "../src/gen/ai_connect";
import { MigrationService } from "../src/gen/migration_connect";
import { MetadataService } from "../src/gen/metadata_connect";
import { connectionServiceHandlers } from "./services/connection-service";
import { queryServiceHandlers } from "./services/query-service";
import { aiServiceHandlers } from "./services/ai-service";
import { migrationServiceHandlers } from "./services/migration-service";
import { metadataServiceHandlers } from "./services/metadata-service";
import { getCurrentUser, type User } from "./lib/auth";
import { isAuthEnabled } from "./lib/config";

const loggingInterceptor: Interceptor = (next) => async (req) => {
  try {
    return await next(req)
  } catch (err) {
    console.error(`[RPC] ${req.service.typeName}/${req.method.name}:`, err)
    throw err
  }
}

// Helper to get user from ConnectRPC context
// Note: contextValues may be a Promise if contextValues factory is async
export async function getUserFromContext(contextValues: Map<string, unknown> | Promise<Map<string, unknown>>): Promise<User | null> {
  const values = await contextValues
  return (values.get('user') as User | null) ?? null
}

// Guest user when auth is disabled
const GUEST_USER: User = { email: 'guest', name: 'Guest' }

/**
 * ConnectRPC router - registers all RPC services
 * Integrated into Express via middleware
 */
export const connectRouter = expressConnectMiddleware({
  routes: (router) => {
    router.service(ConnectionService, connectionServiceHandlers, { interceptors: [loggingInterceptor] });
    router.service(QueryService, queryServiceHandlers, { interceptors: [loggingInterceptor] });
    router.service(AIService, aiServiceHandlers, { interceptors: [loggingInterceptor] });
    router.service(MigrationService, migrationServiceHandlers, { interceptors: [loggingInterceptor] });
    router.service(MetadataService, metadataServiceHandlers, { interceptors: [loggingInterceptor] });
  },
  // Set max message size to ~4GB for large query results
  readMaxBytes: 0xffffffff,
  writeMaxBytes: 0xffffffff,
  // Create context from request
  contextValues: async (req) => {
    const expressReq = req as unknown as Request;
    const contextMap = new Map<string, unknown>();

    if (!isAuthEnabled()) {
      contextMap.set('user', GUEST_USER);
    } else {
      const user = await getCurrentUser(expressReq);
      contextMap.set('user', user);
    }

    return contextMap;
  },
});
