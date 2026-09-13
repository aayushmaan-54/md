import { login } from "../api/auth";
import type { User } from "../api/auth";
import { applyFormError } from "../lib/form";
import { validateLoginPassword, validateLoginUsername } from "../lib/validators";

type LoginViewProps = {
  onSuccess: (user: User) => void;
  onSwitchToSignup: () => void;
};

export function renderLoginView(root: HTMLElement, props: LoginViewProps) {
  root.innerHTML = `
    <section class="auth-view">
      <h1>Log in</h1>
      <form id="login-form" novalidate>
        <div class="field">
          <label for="login-username">Username</label>
          <input
            id="login-username"
            name="username"
            type="text"
            autocomplete="username"
            required
          />
          <span class="field-error" data-field-error="username"></span>
        </div>
        <div class="field">
          <label for="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
          />
          <span class="field-error" data-field-error="password"></span>
        </div>
        <p class="form-error" id="login-form-error"></p>
        <button type="submit">Log in</button>
      </form>
      <p>
        Don't have an account?
        <button type="button" id="go-signup">Sign up</button>
      </p>
    </section>
  `;

  const form = root.querySelector<HTMLFormElement>("#login-form")!;
  const generalError = root.querySelector<HTMLElement>("#login-form-error")!;
  const goSignup = root.querySelector<HTMLButtonElement>("#go-signup")!;
  const submitButton = form.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  )!;
  const usernameInput = form.querySelector<HTMLInputElement>(
    "#login-username",
  )!;
  const passwordInput = form.querySelector<HTMLInputElement>(
    "#login-password",
  )!;
  const usernameError = form.querySelector<HTMLElement>(
    '[data-field-error="username"]',
  )!;
  const passwordError = form.querySelector<HTMLElement>(
    '[data-field-error="password"]',
  )!;

  function revalidate(): boolean {
    const usernameMsg = validateLoginUsername(usernameInput.value);
    const passwordMsg = validateLoginPassword(passwordInput.value);

    usernameError.textContent = usernameMsg ?? "";
    passwordError.textContent = passwordMsg ?? "";

    return !usernameMsg && !passwordMsg;
  }

  function updateSubmitState() {
    const filled =
      usernameInput.value.length > 0 && passwordInput.value.length > 0;
    submitButton.disabled = !filled || !revalidate();
  }

  usernameInput.addEventListener("input", updateSubmitState);
  passwordInput.addEventListener("input", updateSubmitState);
  updateSubmitState();

  goSignup.addEventListener("click", () => props.onSwitchToSignup());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const username = String(data.get("username") ?? "");
    const password = String(data.get("password") ?? "");

    submitButton.disabled = true;
    try {
      const user = await login(username, password);
      props.onSuccess(user);
    } catch (err) {
      applyFormError(form, generalError, err);
    } finally {
      submitButton.disabled = false;
    }
  });
}
