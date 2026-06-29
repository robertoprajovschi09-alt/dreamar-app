import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode, ThHTMLAttributes } from "react";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)}>{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-border text-left">{children}</tr>
    </thead>
  );
}

export function TH({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("whitespace-nowrap px-3 py-2.5 text-[11px] font-700 uppercase tracking-wide text-muted-foreground sm:px-4 sm:py-3", className)}
      {...props}
    >
      {children}
    </th>
  );
}

export function TR({ children, className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("border-b border-border/70 transition hover:bg-muted/40 last:border-0", className)} {...props}>
      {children}
    </tr>
  );
}

export function TD({ children, className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("whitespace-nowrap px-3 py-2.5 align-middle sm:px-4 sm:py-3", className)} {...props}>
      {children}
    </td>
  );
}
