import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const canonicalHostMiddleware = createMiddleware().server(async ({ next, request }) => {
  try {
    const url = new URL(request.url);
    if (url.hostname === "www.duvalericlabs.com") {
      url.hostname = "duvalericlabs.com";
      return new Response(null, {
        status: 301,
        headers: { location: url.toString() },
      });
    }
  } catch {
    // ignore
  }
  return next();
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [canonicalHostMiddleware, errorMiddleware],
}));

