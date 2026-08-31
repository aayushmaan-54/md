import { signup } from "../api/auth";
import type { User } from "../api/auth";
import { applyFormError } from "../lib/form";
import {
  validateConfirmPassword,
  validatePassword,
  validateUsername,
} from "../lib/validators";

type SignupViewProps = {
  onSuccess: (user: User) => void;
  onSwitchToLogin: () => void;
};

export function renderSignupView(root: HTMLElement, props: SignupViewProps) {
  root.innerHTML = `
    <section class="auth-view">
      <h1>Sign up</h1>
      <form id="signup-form" novalidate>
        <div class="field">
          <label for="signup-username">Username</label>
          <input
            id="signup-username"
            name="username"
            type="text"
            autocomplete="username"
            required
          />
          <span class="field-error" data-field-error="username"></span>
        </div>
        <div class="field">
          <label for="signup-password">Password</label>
          <input
            id="signup-password"
            name="password"
            type="password"
            autocomplete="new-password"
            required
          />
          <span class="field-error" data-field-error="password"></span>
        </div>
        <div class="field">
          <label for="signup-confirm-password">Confirm password</label>
          <input
            id="signup-confirm-password"
            name="confirmPassword"
            type="password"
            autocomplete="new-password"
            required
          />
          <span class="field-error" data-field-error="confirmPassword"></span>
        </div>
        <p class="form-error" id="signup-form-error"></p>
        <button type="submit">Sign up</button>
      </form>
      <p>
        Already have an account?
        <button type="button" id="go-login">Log in</button>
      </p>
    </section>
  `;

  const form = root.querySelector<HTMLFormElement>("#signup-form")!;
  const generalError = root.querySelector<HTMLElement>("#signup-form-error")!;
  const goLogin = root.querySelector<HTMLButtonElement>("#go-login")!;
  const submitButton = form.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  )!;

  const usernameInput = form.querySelector<HTMLInputElement>(
    "#signup-username",
  )!;
  const passwordInput = form.querySelector<HTMLInputElement>(
    "#signup-password",
  )!;
  const confirmInput = form.querySelector<HTMLInputElement>(
    "#signup-confirm-password",
  )!;
  const usernameError = form.querySelector<HTMLElement>(
    '[data-field-error="username"]',
  )!;
  const passwordError = form.querySelector<HTMLElement>(
    '[data-field-error="password"]',
  )!;
  const confirmError = form.querySelector<HTMLElement>(
    '[data-field-error="confirmPassword"]',
  )!;

  // Live, as-you-type validation mirroring the server's rules. Returns
  // whether the form is currently valid so the caller can gate submit.
  function revalidate(): boolean {
    const usernameMsg = validateUsername(usernameInput.value);
    const passwordMsg = validatePassword(
      passwordInput.value,
      usernameInput.value,
    );
    const confirmMsg = validateConfirmPassword(
      passwordInput.value,
      confirmInput.value,
    );

    usernameError.textContent = usernameMsg ?? "";
    passwordError.textContent = passwordMsg ?? "";
    confirmError.textContent = confirmMsg ?? "";

    return !usernameMsg && !passwordMsg && !confirmMsg;
  }

  function updateSubmitState() {
    const filled =
      usernameInput.value.length > 0 &&
      passwordInput.value.length > 0 &&
      confirmInput.value.length > 0;
    submitButton.disabled = !filled || !revalidate();
  }

  usernameInput.addEventListener("input", updateSubmitState);
  passwordInput.addEventListener("input", updateSubmitState);
  confirmInput.addEventListener("input", updateSubmitState);
  updateSubmitState();

  goLogin.addEventListener("click", () => props.onSwitchToLogin());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const username = String(data.get("username") ?? "");
    const password = String(data.get("password") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");

    submitButton.disabled = true;
    try {
      const user = await signup(username, password, confirmPassword);
      props.onSuccess(user);
    } catch (err) {
      applyFormError(form, generalError, err);
    } finally {
      submitButton.disabled = false;
    }
  });
}
