import { cookies } from "next/headers";
import { erpFetch } from "../_lib";

export async function POST() {
  await erpFetch("/api/method/logout", { method: "POST" }).catch(() => {});
  (await
        cookies()).delete("erp_sid");
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
