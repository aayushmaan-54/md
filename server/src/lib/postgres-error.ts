export function isPostgresErrorCode<Code extends string>(
  err: unknown,
  code: Code,
): err is { code: Code } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === code
  );
}
