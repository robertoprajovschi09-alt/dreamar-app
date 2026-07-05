import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, forwardRef } from "react";
import { ArrowDownRight, ArrowUpRight, type LucideIcon, Search } from "lucide-react";
import { PageHelp, type HelpKey } from "@/components/PageHelp";

/* ----------------------------- Card / Panel ----------------------------- */
export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("panel", className)} {...props} />;
}

export function SectionCard({
  title,
  subtitle,
  action,
  icon: Icon,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}) {
  return (
    <Panel className={cn("flex flex-col", className)}>
      {(title || action) && (
        <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:pt-5">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div>
              {title && <h3 className="font-display text-[15px] font-700 tracking-tight">{title}</h3>}
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </Panel>
  );
}

/* -------------------------------- Button -------------------------------- */
const btnVariants: Record<string, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-soft hover:brightness-110 active:scale-[0.98]",
  outline: "border border-border bg-card hover:bg-muted text-foreground",
  ghost: "hover:bg-muted text-muted-foreground hover:text-foreground",
  soft: "bg-primary/10 text-primary hover:bg-primary/15",
  danger: "bg-danger text-danger-foreground hover:brightness-105",
  dark: "bg-foreground text-background hover:opacity-90",
};
const btnSizes: Record<string, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
  icon: "h-9 w-9",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof btnVariants;
  size?: keyof typeof btnSizes;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "outline", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex select-none items-center justify-center rounded-lg font-600 transition ring-focus disabled:opacity-50",
        btnVariants[variant],
        btnSizes[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";

export function IconButton({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition hover:text-foreground hover:bg-muted ring-focus",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* --------------------------------- Badge -------------------------------- */
const tones: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/12 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-[hsl(var(--warning))]",
  danger: "bg-danger/12 text-danger",
  info: "bg-info/12 text-info",
};
export function Badge({
  tone = "neutral",
  className,
  children,
  dot,
}: {
  tone?: keyof typeof tones;
  className?: string;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-600",
        tones[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function TrendChip({ value, className }: { value: number; className?: string }) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-700",
        up ? "bg-success/12 text-success" : "bg-danger/12 text-danger",
        className
      )}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value)}%
    </span>
  );
}

/* -------------------------------- Avatar -------------------------------- */
export function Avatar({
  name,
  src,
  size = 36,
  className,
}: {
  name: string;
  src?: string;
  size?: number;
  className?: string;
}) {
  const inits = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn(
        "grid place-items-center overflow-hidden rounded-full bg-primary/15 font-700 text-primary ring-2 ring-background",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : inits}
    </span>
  );
}

/* ------------------------------- Progress ------------------------------- */
export function Progress({ value, className, tone = "primary" }: { value: number; className?: string; tone?: string }) {
  const colors: Record<string, string> = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  };
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full transition-all", colors[tone] ?? colors.primary)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

/* --------------------------------- Input -------------------------------- */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm placeholder:text-muted-foreground ring-focus",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        className="h-10 w-full rounded-lg border border-input bg-muted/40 pl-9 pr-3 text-sm placeholder:text-muted-foreground ring-focus"
        {...props}
      />
    </div>
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 rounded-lg border border-input bg-card px-3 text-sm font-500 text-foreground ring-focus",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/* ------------------------------ Segmented ------------------------------- */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-border bg-muted/50 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-600 transition",
            value === o.value ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ EmptyState ------------------------------ */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="font-display text-sm font-700">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------ Page header ----------------------------- */
export function PageHeader({
  title,
  subtitle,
  help,
  children,
}: {
  title: string;
  subtitle?: string;
  help?: HelpKey;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-800 tracking-tight">{title}</h1>
          {help && <PageHelp page={help} />}
        </div>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
