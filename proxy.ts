import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

function preserveSessionCookies(response: NextResponse, updatedSession: NextResponse) {
  for (const cookie of updatedSession.cookies.getAll()) response.cookies.set(cookie);
  return response;
}

function secureHeaders(response: NextResponse, path: string) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (path.startsWith("/studio") || path.startsWith("/api/studio/")) {
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const sessionResponse = await updateSession(request);
  const studioApi = path.startsWith("/api/studio/");
  const studioPage = path === "/studio" || path.startsWith("/studio/");
  const mfaExempt = path === "/studio/login" || path.startsWith("/studio/login/") ||
    path === "/studio/security" || path.startsWith("/studio/security/");

  // Enrollment first, enforcement second. Do not enable until an admin has
  // enrolled and successfully reached AAL2 at /studio-security.
  if (process.env.STUDIO_REQUIRE_MFA !== "true" ||
      !(studioApi || (studioPage && !mfaExempt))) {
    return secureHeaders(sessionResponse, path);
  }

  // Defense in depth: the Studio routes must ALSO check admin membership.
  // This check is not an authorization substitute for the route itself.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // The updateSession() call above owns session-cookie refresh.
        },
      },
    }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    if (studioApi) return secureHeaders(preserveSessionCookies(NextResponse.json(
      { error: "Studio sign-in required." }, { status: 401 }
    ), sessionResponse), path);
    return secureHeaders(preserveSessionCookies(NextResponse.redirect(new URL("/studio/login", request.url)), sessionResponse), path);
  }
  const { data: assurance, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || assurance?.currentLevel !== "aal2") {
    if (studioApi) return secureHeaders(preserveSessionCookies(NextResponse.json(
      { error: "Studio authenticator verification required.", code: "STUDIO_MFA_REQUIRED" },
      { status: 403 }
    ), sessionResponse), path);
    return secureHeaders(preserveSessionCookies(NextResponse.redirect(new URL("/studio-security", request.url)), sessionResponse), path);
  }
  return secureHeaders(sessionResponse, path);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
