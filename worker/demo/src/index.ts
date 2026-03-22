import { Container } from "@cloudflare/containers";

interface Env {
  PGCONSOLE_CONTAINER: DurableObjectNamespace<PgConsoleContainer>;
}

export class PgConsoleContainer extends Container {
  defaultPort = 9876;

  override getContainerImage(): string {
    return "docker.io/pgplex/pgconsole:1.1.1";
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = env.PGCONSOLE_CONTAINER.idFromName("default");
    const stub = env.PGCONSOLE_CONTAINER.get(id);
    return stub.fetch(request);
  },
};
