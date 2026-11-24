const wholeDollarFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
});

export function formatWholeDollars(amount: number): string {
    const normalized = Object.is(amount, -0) ? 0 : amount;
    return wholeDollarFormatter.format(normalized);
}
