import { requireStudioMfa } from "@/lib/studio/requireStudioMfa";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED =
  new Set([
    "EUR",
    "GBP",
    "USD",
  ]);

async function safeJson(
  response: Response
) {
  const text =
    await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      rawResponse:
        text.slice(0, 300),
    };
  }
}

export async function GET(
  request: Request
) {
  const __letionMfa = await requireStudioMfa();
  if (!__letionMfa.ok) {
    return NextResponse.json(
      { error: __letionMfa.error },
      { status: __letionMfa.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    /*
     * Admin authentication
     */

    const supabase =
      await createClient();

    const {
      data: { user },
      error: authError,
    } =
      await supabase.auth.getUser();

    if (
      authError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "Not authenticated.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: admin,
      error: adminError,
    } =
      await supabase
        .from(
          "studio_admins"
        )
        .select("user_id")
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

    if (
      adminError ||
      !admin
    ) {
      return NextResponse.json(
        {
          error:
            "Studio administrator access required.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * Read currencies
     */

    const url =
      new URL(
        request.url
      );

    const from = (
      url.searchParams.get(
        "from"
      ) ?? ""
    ).toUpperCase();

    const to = (
      url.searchParams.get(
        "to"
      ) ?? ""
    ).toUpperCase();

    if (
      !SUPPORTED.has(from) ||
      !SUPPORTED.has(to)
    ) {
      return NextResponse.json(
        {
          error:
            "Unsupported currency.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Same currency
     */

    if (from === to) {
      return NextResponse.json({
        from,
        to,
        rate: 1,
        date: null,
        source:
          "Same currency",
      });
    }

    /*
     * Frankfurter
     */

    const response =
      await fetch(
        `https://api.frankfurter.dev/v2/rate/${from.toLowerCase()}/${to.toLowerCase()}`,
        {
          headers: {
            Accept:
              "application/json",
          },

          next: {
            revalidate:
              3600,
          },

          signal:
            AbortSignal.timeout(
              10000
            ),
        }
      );

    const result =
      await safeJson(
        response
      );

    if (!response.ok) {
      console.error(
        "FX API error:",
        response.status,
        result
      );

      return NextResponse.json(
        {
          error:
            "Could not retrieve exchange rate.",
        },
        {
          status: 502,
        }
      );
    }

    const rate =
      Number(result.rate);

    if (
      !Number.isFinite(
        rate
      ) ||
      rate <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid exchange rate returned.",
        },
        {
          status: 502,
        }
      );
    }

    return NextResponse.json({
      from,
      to,
      rate,

      date:
        typeof result.date ===
        "string"
          ? result.date
          : null,

      source:
        "Frankfurter reference rate",
    });
  } catch (error) {
    console.error(
      "FX endpoint:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Exchange-rate lookup failed.",
      },
      {
        status: 502,
      }
    );
  }
}