import * as Sentry from "@sentry/nextjs";
import { bereinigeSentryEvent } from "./lib/sentry-privacy";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  enableLogs: false,
  sendClientReports: false,
  maxBreadcrumbs: 0,
  beforeSend: (event) => bereinigeSentryEvent(event, {
    laufzeit: "edge",
    umgebung: process.env.VERCEL_ENV ?? (process.env.NODE_ENV === "development" ? "development" : undefined),
    release: process.env.VERCEL_GIT_COMMIT_SHA,
  }),
  beforeBreadcrumb: () => null,
});
