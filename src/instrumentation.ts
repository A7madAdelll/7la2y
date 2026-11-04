import type { Instrumentation } from "next";

/**
 * Server errors (pages, route handlers, server actions, proxy) -> Sentry, when SENTRY_DSN is set.
 * Imported lazily so the reporter only loads on the Node.js server when an error actually happens.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (!process.env.SENTRY_DSN || process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError } = await import("@/lib/error-report");
  await reportError(err, {
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
