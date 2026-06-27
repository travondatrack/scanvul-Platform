export const VIETNAM_LOCALE = "vi-VN";
export const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

type DateInput = string | number | Date | null | undefined;

function toValidDate(value: DateInput) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatVietnamDateTime(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = {},
) {
  const date = toValidDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat(VIETNAM_LOCALE, {
    timeZone: VIETNAM_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  }).format(date);
}

export function formatVietnamDate(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = {},
) {
  const date = toValidDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat(VIETNAM_LOCALE, {
    timeZone: VIETNAM_TIME_ZONE,
    dateStyle: "medium",
    ...options,
  }).format(date);
}

export function formatVietnamTime(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = {},
) {
  const date = toValidDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat(VIETNAM_LOCALE, {
    timeZone: VIETNAM_TIME_ZONE,
    timeStyle: "medium",
    ...options,
  }).format(date);
}
