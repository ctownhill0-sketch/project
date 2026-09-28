type NumFormat = "number" | "currency" | "percent";

const formatters: Record<NumFormat, Intl.NumberFormat> = {
  number: new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }),
  currency: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
  percent: new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }),
};

interface NumProps {
  value: number | null | undefined;
  format?: NumFormat;
  className?: string;
}

/** Every number in the UI goes through this: tabular figures, and "unknown" instead of a guess. */
export function Num({ value, format = "number", className }: NumProps) {
  const text =
    value === null || value === undefined || Number.isNaN(value)
      ? "unknown"
      : formatters[format].format(value);
  return <span className={className ? `num ${className}` : "num"}>{text}</span>;
}
