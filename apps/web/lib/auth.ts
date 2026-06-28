import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { isValidEmail, normalizeEmail } from "@/lib/auth-policy";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

function hasOAuthValue(value: string | undefined) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().replace(/^['\"]|['\"]$/g, "").toLowerCase();
  return Boolean(normalized)
    && !normalized.startsWith("placeholder")
    && !normalized.startsWith("change_me");
}

const getGoogleClientId = () => process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
const getGoogleClientSecret = () => process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET;

export const isGoogleAuthEnabled = (
  hasOAuthValue(getGoogleClientId() || "")
  && hasOAuthValue(getGoogleClientSecret() || "")
);

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      const email = normalizeEmail(credentials?.email);
      const password = credentials?.password ?? "";

      const limit = checkRateLimit(
        rateLimitKey("login", email),
        { limit: 10, windowMs: 15 * 60 * 1000 },
      );

      if (!limit.allowed) {
        throw new Error("Too many login attempts");
      }

      if (!isValidEmail(email) || !password) {
        throw new Error("Invalid credentials");
      }

      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user || !user.password) {
        throw new Error("Invalid credentials");
      }

      if (user.status !== "active") {
        throw new Error("Account disabled");
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        throw new Error("Invalid credentials");
      }

      if (!user.emailVerified) {
        throw new Error("Email not verified");
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        roleGlobal: user.roleGlobal,
        status: user.status,
      };
    }
  }),
];

if (isGoogleAuthEnabled) {
  providers.push(
    GoogleProvider({
      clientId: getGoogleClientId()!,
      clientSecret: getGoogleClientSecret()!,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email ? normalizeEmail(profile.email) : profile.email,
          image: profile.picture,
          emailVerified: profile.email_verified ? new Date() : null,
          roleGlobal: "user",
          status: "active",
        };
      },
    }),
  );
}

export const authOptions: NextAuthOptions = {
  // No adapter — we use JWT strategy and handle all DB operations manually.
  // Mixing PrismaAdapter with strategy:"jwt" causes OAuthAccountNotLinked errors
  // because NextAuth's adapter checks run before the signIn callback.
  providers,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) {
        return false;
      }

      const email = normalizeEmail(user.email);

      // ── Google OAuth ──────────────────────────────────────────────────────
      if (account?.provider === "google") {
        if (!profile || !("email_verified" in profile) || (profile as any).email_verified !== true) {
          return false;
        }

        // Find or create user in our DB
        let dbUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true, status: true, emailVerified: true },
        });

        if (!dbUser) {
          // Brand-new user signing up via Google
          dbUser = await prisma.user.create({
            data: {
              email,
              name: user.name,
              image: user.image,
              emailVerified: new Date(),
              roleGlobal: "user",
              status: "active",
            },
            select: { id: true, status: true, emailVerified: true },
          });
        }

        if (dbUser.status !== "active") {
          return false;
        }

        // Link Google account to this user if not already linked
        if (account.providerAccountId) {
          const existingAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId,
              },
            },
          });

          if (!existingAccount) {
            await prisma.account.create({
              data: {
                userId: dbUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              },
            });
          }
        }

        if (!dbUser.emailVerified) {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { emailVerified: new Date() },
          });
        }

        // Point user.id to our DB user so JWT token.sub is correct
        user.id = dbUser.id;

        return true;
      }

      // ── Credentials ───────────────────────────────────────────────────────
      const dbUser = await prisma.user.findUnique({
        where: { email },
        select: { status: true },
      });

      return dbUser?.status === "active";
    },

    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.roleGlobal = (user as any).roleGlobal ?? "user";
        token.status = (user as any).status ?? "active";
      }

      // Always refresh from DB so role/status changes take effect immediately
      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { email: true, name: true, image: true, roleGlobal: true, status: true },
        });

        if (dbUser) {
          token.email = dbUser.email;
          token.name = dbUser.name;
          token.picture = dbUser.image;
          token.roleGlobal = dbUser.roleGlobal;
          token.status = dbUser.status;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
        (session.user as any).roleGlobal = token.roleGlobal ?? "user";
        (session.user as any).status = token.status ?? "active";
      }
      return session;
    },
  },
};
