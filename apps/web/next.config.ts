import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig = {
  serverExternalPackages: ["bcryptjs", "@prisma/client", "next-auth", "bcrypt"],
  experimental: {
    reactCompiler: false,
  },
};

export default withNextIntl(nextConfig);
