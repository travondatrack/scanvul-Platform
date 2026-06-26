import { withAuth } from "next-auth/middleware";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";

import { defaultLocale, locales } from "@/lib/i18n";

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
});

const protectedPathPattern = /^\/(dashboard|projects|scans|reports|team)(\/.*)?$/;
const protectedApiPattern = /^\/api\/(projects|organizations|scan|scans\/trigger|findings|v1)(\/.*)?$/;
const localePathPattern = new RegExp(`^/(${locales.join("|")})(/.*)?$`);

export default withAuth(
  function middleware(req) {
    if (localePathPattern.test(req.nextUrl.pathname)) {
      return intlMiddleware(req);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const activeToken = Boolean(token) && (token as any).status === "active";

        if (protectedApiPattern.test(req.nextUrl.pathname)) {
          return activeToken;
        }

        if (protectedPathPattern.test(req.nextUrl.pathname)) {
          return activeToken;
        }

        return true;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: ["/((?!_next|.*\\..*).+)"],
};
