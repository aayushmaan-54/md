import { ApiRequestError } from "../api/client";

// Clears previous errors, then re-populates [data-field-error="<path>"]
// elements from the API's per-field validation errors. Anything that
// doesn't match a field (e.g. "confirmPassword" refine errors targeting a
// field not on this form, or a plain message like "Username is already
// taken") falls back to the general error element.
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
