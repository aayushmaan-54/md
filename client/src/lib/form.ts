import { ApiRequestError } from "../api/client";

// Populates [data-field-error="<path>"] elements from the API's
// per-field errors; anything unmatched falls back to generalErrorEl.
export function applyFormError(
  form: HTMLFormElement,
  generalErrorEl: HTMLElement,
  err: unknown,
) {
  form
    .querySelectorAll<HTMLElement>("[data-field-error]")
    .forEach((el) => (el.textContent = ""));
  generalErrorEl.textContent = "";

  if (!(err instanceof ApiRequestError)) {
    generalErrorEl.textContent = "Something went wrong. Please try again.";
    return;
  }

  if (err.errors.length === 0) {
    generalErrorEl.textContent = err.message;
    return;
  }

  const unmatched: string[] = [];
  for (const issue of err.errors) {
    const target = form.querySelector<HTMLElement>(
      `[data-field-error="${issue.path}"]`,
    );
    if (target) target.textContent = issue.message;
    else unmatched.push(issue.message);
  }

  if (unmatched.length > 0) generalErrorEl.textContent = unmatched.join(" ");
}

// Like applyFormError, but for plain-text surfaces (toasts, status
// messages) with no per-field slots to populate.
export function describeApiError(err: unknown): string {
  if (err instanceof ApiRequestError) {
    if (err.errors.length > 0) {
      return `${err.message}: ${err.errors.map((issue) => issue.message).join("; ")}`;
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "unknown error";
}
