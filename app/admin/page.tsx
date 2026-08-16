import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { hasActiveAdminSession } from "@/lib/admin-auth";
import { getRuntimeEnv } from "@/lib/runtime-env";
import AdminSystem from "./admin-system";

export const dynamic = "force-dynamic";

/**
 * The administrator screen is rendered on the server only for a signed-in administrator.
 * Anyone typing the address without a valid session gets an ordinary "not found" page,
 * so the system never flashes on screen and the address gives nothing away.
 */
export default async function AdminPage() {
  let signedIn = false;
  try {
    const headerList = await headers();
    signedIn = await hasActiveAdminSession(headerList.get("cookie"), getRuntimeEnv());
  } catch {
    signedIn = false;
  }
  if (!signedIn) notFound();
  return <AdminSystem />;
}
