type HttpHandler = (request: any) => Promise<any>;

export interface HttpResponseInit {
  status?: number;
  jsonBody?: unknown;
}

export type HttpRequest = any;

export const httpHandlers = new Map<string, HttpHandler>();

export const app = {
  http(name: string, options: { handler: HttpHandler }) {
    httpHandlers.set(name, options.handler);
  },
};
