export function require_fixture<T>(value: T | null | undefined): T {
  if (value === null || value === undefined)
    throw new Error("Required test fixture is missing");
  return value;
}
