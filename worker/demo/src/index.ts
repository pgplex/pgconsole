import { Container } from "@cloudflare/containers";

interface Env {
  PGCONSOLE_CONTAINER: DurableObjectNamespace<Demo>;
}

export class Demo extends Container {
  defaultPort = 9876;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = env.PGCONSOLE_CONTAINER.idFromName("default");
    const stub = env.PGCONSOLE_CONTAINER.get(id);
    return stub.fetch(request);
  },
};
