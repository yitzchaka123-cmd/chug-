import { ChoirLoader } from "../loader";

export default function AdminLoading() {
  return (
    <main className="admin-route-loading">
      <ChoirLoader variant="page" label="Opening the administrator system…" />
    </main>
  );
}
