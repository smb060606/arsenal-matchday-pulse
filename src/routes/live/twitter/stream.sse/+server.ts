import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ setHeaders, url }) => {
  setHeaders({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });

  const matchId = url.searchParams.get("matchId") ?? "demo";

  const stream = new ReadableStream({
    start(controller) {
      let i = 0;
      const iv = setInterval(() => {
        const payload = {
          matchId,
          platform: "twitter",
          window: "live",
          generatedAt: new Date().toISOString(),
          tick: i++,
          sentiment: { pos: Math.random(), neu: Math.random(), neg: Math.random() }
        };
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`));
      }, 3500);

      setTimeout(() => {
        clearInterval(iv);
        controller.close();
      }, 60000);
    }
  });

  return new Response(stream);
};
