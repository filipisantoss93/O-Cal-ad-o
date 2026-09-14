import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import { sendNotification } from "npm:web-push-neo@0.1.2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(null, { status: 405 });

  const { data: config, error: configError } = await supabase.rpc("admin_push_config").single();
  if (configError || !config?.dispatch_token) {
    console.error("Push config unavailable", configError?.code ?? "missing config");
    return new Response(null, { status: 503 });
  }
  if (request.headers.get("X-Dispatch-Token") !== config.dispatch_token) {
    return new Response(null, { status: 401 });
  }

  let id: number;
  try {
    const input = await request.json();
    id = Number(input.id);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!Number.isSafeInteger(id) || id <= 0) return new Response(null, { status: 400 });

  const { data: notice, error: noticeError } = await supabase
    .from("admin_notifications")
    .select("id, recipient_id, title, body, destination, pushed_at, push_attempts")
    .eq("id", id)
    .maybeSingle();
  if (noticeError) return new Response(null, { status: 500 });
  if (!notice || notice.pushed_at) return new Response(null, { status: 204 });
  if (!config.public_key || !config.private_key) return new Response(null, { status: 503 });

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from("admin_push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", notice.recipient_id)
    .limit(20);
  if (subscriptionsError) return new Response(null, { status: 500 });

  // Lock-screen payloads never include private support messages or denunciation details.
  const payload = JSON.stringify({
    title: notice.title,
    body: "Abra o painel para ver os detalhes.",
    url: notice.destination,
    tag: `admin-notification-${notice.id}`,
  });
  let retry = false;

  for (const subscription of subscriptions ?? []) {
    try {
      await sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        payload,
        {
          vapidDetails: {
            subject: "mailto:suporte@ocalcadao.com.br",
            publicKey: config.public_key,
            privateKey: config.private_key,
          },
          TTL: 3600,
          urgency: "normal",
          signal: AbortSignal.timeout(8000),
        },
      );
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await supabase.from("admin_push_subscriptions").delete().eq("endpoint", subscription.endpoint);
      } else {
        retry = true;
        console.error("Admin push delivery failed", status ?? "network");
      }
    }
  }

  const { error: updateError } = await supabase.from("admin_notifications").update({
    push_attempts: notice.push_attempts + 1,
    ...(retry ? {} : { pushed_at: new Date().toISOString() }),
  }).eq("id", id);
  if (updateError) return new Response(null, { status: 500 });
  return new Response(null, { status: retry ? 503 : 204 });
});
