import * as Sentry from "@sentry/nextjs";
import { bereinigeSentryEvent, sentryDatenminimierung } from "./lib/sentry-privacy";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  dataCollection: sentryDatenminimierung,
  tracesSampleRate: 0,
  integrations: [Sentry.httpIntegration({ sessions: false })],
  enableLogs: false,
  sendClientReports: false,
  maxBreadcrumbs: 0,
  beforeSend: (event) => bereinigeSentryEvent(event, {
    laufzeit: "server",
    umgebung: process.env.VERCEL_ENV ?? (process.env.NODE_ENV === "development" ? "development" : undefined),
    release: process.env.VERCEL_GIT_COMMIT_SHA,
  }),
  beforeBreadcrumb: () => null,
});
