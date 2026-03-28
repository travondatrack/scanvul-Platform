import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "danger";
};

export function Button({
  className,
  variant = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition",
        variant === "default" && "bg-brand-600 text-white hover:bg-brand-700",
        variant === "outline" &&
          "border border-brand-300 bg-white/70 text-brand-800 hover:bg-brand-50",
        variant === "danger" && "bg-danger text-white hover:opacity-90",
        className,
      )}
      {...props}
    />
  );
}
