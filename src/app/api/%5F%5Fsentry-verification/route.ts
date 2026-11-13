import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.VERCEL_ENV !== "preview") notFound();
  throw new Error("FCB_SENTRY_TEST_SERVER");
}
