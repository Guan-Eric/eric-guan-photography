"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
  pendingLabel?: ReactNode;
};

export function LoadingButton({
  pending = false,
  pendingLabel,
  children,
  className = "btn btn-solid",
  disabled,
  type = "button",
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={`${className}${pending ? " is-busy" : ""}`}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? (pendingLabel ?? children) : children}
    </button>
  );
}
