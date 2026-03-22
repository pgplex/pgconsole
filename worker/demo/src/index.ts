import { Container } from "@cloudflare/containers";

interface Env {
  PGCONSOLE_CONTAINER: Container;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return env.PGCONSOLE_CONTAINER.fetch(request);
  },
};
