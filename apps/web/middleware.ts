import { withAuth } from "next-auth/middleware";
export default withAuth(
  // `withAuth` augments your `Request` with the user's token.
  function middleware(req) {
    // We can add custom logic here if needed
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    }
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/team/:path*"],
};
