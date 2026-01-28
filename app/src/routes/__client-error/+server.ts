import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    console.log('[client-error]', JSON.stringify(body));
  } catch (e) {
    console.log('[client-error] invalid body', e);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
