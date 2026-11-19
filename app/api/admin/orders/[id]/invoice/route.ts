import { NextResponse } from "next/server";
import { requireActiveStudio } from "@/lib/admin-guards";
import { requireTenantMembership } from "@/lib/auth";
import {
  createInvoiceForOrder,
  getInvoiceForOrder,
  resendInvoice,
} from "@/lib/invoices";
import { readMediaFile } from "@/lib/media-storage";
import { getOrder } from "@/lib/orders";

export const runtime = "nodejs";

type Params = { id: string };

async function loadOrder(orderId: string) {
  const order = await getOrder(orderId);
  if (!order) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 }),
    };
  }
  const auth = await requireTenantMembership(order.tenantId);
  if (!auth.ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: auth.error }, { status: 401 }),
    };
  }
  const active = await requireActiveStudio(order.tenantId);
  if (!active.ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: active.error }, { status: 403 }),
    };
  }
  return { ok: true as const, order };
}

export async function GET(
  request: Request,
  context: { params: Promise<Params> },
) {
  const { id: orderId } = await context.params;
  const loaded = await loadOrder(orderId);
  if (!loaded.ok) return loaded.response;

  const invoice = await getInvoiceForOrder(orderId, loaded.order.tenantId);
  const download = new URL(request.url).searchParams.get("download") === "1";

  if (!invoice) {
    return NextResponse.json({ ok: true, invoice: null });
  }

  if (!download) {
    return NextResponse.json({
      ok: true,
      invoice: {
        id: invoice.id,
        number: invoice.number,
        amountCents: invoice.amountCents,
        currency: invoice.currency,
        createdAt: invoice.createdAt,
      },
    });
  }

  try {
    const pdf = await readMediaFile(invoice.pdfPath);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Invoice-${invoice.number}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invoice PDF is missing. Generate it again." },
      { status: 404 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<Params> },
) {
  const { id: orderId } = await context.params;
  const loaded = await loadOrder(orderId);
  if (!loaded.ok) return loaded.response;
  const { order } = loaded;

  if (order.status !== "paid") {
    return NextResponse.json(
      { ok: false, error: "Invoices are only available after the order is paid." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const action = body?.action as string | undefined;

  if (action === "resend") {
    const result = await resendInvoice({
      tenantId: order.tenantId,
      orderId,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      invoice: {
        id: result.invoice.id,
        number: result.invoice.number,
      },
      stubbed: result.stubbed ?? false,
    });
  }

  try {
    const created = await createInvoiceForOrder({
      tenantId: order.tenantId,
      orderId,
    });
    return NextResponse.json({
      ok: true,
      created: created.created,
      invoice: {
        id: created.invoice.id,
        number: created.invoice.number,
        amountCents: created.invoice.amountCents,
        currency: created.invoice.currency,
        createdAt: created.invoice.createdAt,
      },
    });
  } catch (error) {
    console.error("[invoice] admin generate failed", { orderId, error });
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Could not generate invoice.",
      },
      { status: 500 },
    );
  }
}
