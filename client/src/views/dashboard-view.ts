import type { User } from "../api/auth";

type DashboardViewProps = {
  user: User;
  onLogout: () => void;
};

// Placeholder authenticated view — stands in for the notes UI, which
// isn't built yet. Just proves the auth flow (login/signup -> session
// -> logout) end to end.
export function renderDashboardView(
  root: HTMLElement,
  props: DashboardViewProps,
) {
  root.innerHTML = `
    <section class="dashboard-view">
      <p>Logged in as <strong id="dashboard-username"></strong></p>
      <button type="button" id="logout-button">Log out</button>
    </section>
  `;

  root.querySelector<HTMLElement>("#dashboard-username")!.textContent =
    props.user.username;

  root
    .querySelector<HTMLButtonElement>("#logout-button")!
    .addEventListener("click", () => props.onLogout());
}
