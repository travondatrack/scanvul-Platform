import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { isValidEmail, normalizeEmail } from "@/lib/auth-policy";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
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

if (googleEnabled) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) {
        return false;
      }

      const dbUser = await prisma.user.findUnique({
        where: { email: normalizeEmail(user.email) },
        select: { status: true },
      });

      return dbUser?.status !== "disabled";
    },
    async jwt({ token, user }) {
      if (user) {
        token.roleGlobal = (user as any).roleGlobal ?? "user";
        token.status = (user as any).status ?? "active";
      }

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
