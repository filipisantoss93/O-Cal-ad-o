import "server-only";

const productionBaseUrl = "https://cobrancas.api.efipay.com.br";
const sandboxBaseUrl = "https://cobrancas-h.api.efipay.com.br";

type EfiAuthorizeResponse = {
  access_token?: string;
};

type EfiPlanResponse = {
  data?: {
    plan_id?: number;
  };
};

type EfiSubscriptionLinkResponse = {
  data?: {
    subscription_id?: number;
    payment_url?: string;
    charge?: {
      id?: number;
    };
  };
};

export function hasEfiChargesConfig() {
  return Boolean(
    process.env.EFI_CLIENT_ID?.trim() && process.env.EFI_CLIENT_SECRET?.trim(),
  );
}

function getEfiConfig() {
  const clientId = process.env.EFI_CLIENT_ID?.trim();
  const clientSecret = process.env.EFI_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Efí não configurada. Defina EFI_CLIENT_ID e EFI_CLIENT_SECRET no servidor.",
    );
  }
  return {
    clientId,
    clientSecret,
    baseUrl:
      process.env.EFI_CHARGES_SANDBOX?.trim().toLowerCase() === "false"
        ? productionBaseUrl
        : sandboxBaseUrl,
  };
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("A Efí retornou uma resposta inválida.");
  }
}

async function getAccessToken() {
  const { baseUrl, clientId, clientSecret } = getEfiConfig();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${baseUrl}/v1/authorize`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
    cache: "no-store",
  });
  const payload = (await readJson(response)) as EfiAuthorizeResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error("Não foi possível autenticar a integração com a Efí.");
  }
  return { baseUrl, token: payload.access_token };
}

async function efiRequest<T>(path: string, init: RequestInit) {
  const { baseUrl, token } = await getAccessToken();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error("A Efí recusou a solicitação de cobrança.");
  }
  return payload as T;
}

export async function createEfiCardSubscriptionLink(input: {
  userId: string;
  intervalMonths: 1 | 6 | 12;
  priceCents: number;
  cycleLabel: string;
  notificationUrl: string;
}) {
  const plan = await efiRequest<EfiPlanResponse>("/v1/plan", {
    method: "POST",
    body: JSON.stringify({
      name: `O Calçadão Pro - ${input.cycleLabel}`,
      interval: input.intervalMonths,
    }),
  });
  const planId = plan.data?.plan_id;
  if (!planId) throw new Error("A Efí não retornou o plano da assinatura.");

  const expireAt = new Date();
  expireAt.setUTCDate(expireAt.getUTCDate() + 3);
  const expireDate = expireAt.toISOString().slice(0, 10);
  const customId = `ocalcadao:pro:${input.userId}:${Date.now()}`;
  const subscription = await efiRequest<EfiSubscriptionLinkResponse>(
    `/v1/plan/${planId}/subscription/one-step/link`,
    {
      method: "POST",
      body: JSON.stringify({
        items: [
          {
            name: `Assinatura O Calçadão Pro - ${input.cycleLabel}`,
            value: input.priceCents,
            amount: 1,
          },
        ],
        metadata: {
          custom_id: customId,
          notification_url: input.notificationUrl,
        },
        settings: {
          payment_method: "credit_card",
          expire_at: expireDate,
          request_delivery_address: false,
        },
      }),
    },
  );

  const subscriptionId = subscription.data?.subscription_id;
  const paymentUrl = subscription.data?.payment_url;
  if (!subscriptionId || !paymentUrl) {
    throw new Error("A Efí não retornou o link de pagamento da assinatura.");
  }

  return {
    planId: String(planId),
    subscriptionId: String(subscriptionId),
    chargeId: subscription.data?.charge?.id
      ? String(subscription.data.charge.id)
      : null,
    paymentUrl,
    customId,
  };
}

export async function getEfiChargeNotification(notificationToken: string) {
  return efiRequest<{
    data?: Array<{
      id?: number;
      type?: string;
      custom_id?: string | null;
      status?: { current?: string; previous?: string | null };
      identifiers?: {
        subscription_id?: number;
        charge_id?: number;
      };
      created_at?: string;
    }>;
  }>(`/v1/notification/${encodeURIComponent(notificationToken)}`, {
    method: "GET",
  });
}
