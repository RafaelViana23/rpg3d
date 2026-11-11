export const normalizeDamage = (damage: number) => Math.max(1, Math.round(damage));

export function targetRadius(id: string) {
  if (id === "bear") return .85;
  if (id === "wolf" || id === "puma") return .55;
  if (id === "deer") return .65;
  if (id === "chicken") return .176;
  if (id === "rat") return .07;
  return .3;
}

export function targetHeight(id: string) {
  if (id === "bear") return 1.05;
  if (id === "wolf" || id === "puma") return .62;
  if (id === "deer") return .85;
  if (id === "chicken") return .24;
  if (id === "rat") return .065;
  return .3;
}
