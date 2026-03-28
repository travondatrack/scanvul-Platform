import { getRequestConfig } from "next-intl/server";

import { defaultLocale, locales } from "@/lib/i18n";

export default getRequestConfig(async ({ locale }) => {
  const activeLocale = locales.includes(locale as (typeof locales)[number])
    ? locale
    : defaultLocale;

  return {
    locale: activeLocale,
    messages: (await import(`../messages/${activeLocale}.json`)).default,
  };
});
