export function round(amount: number) {
    return Math.round(amount + Number.EPSILON);
}
