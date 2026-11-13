import * as Sentry from "@sentry/nextjs";
import { bereinigeSentryEvent } from "./lib/sentry-privacy";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  enableLogs: false,
  integrations: (integrations) => integrations.filter((integration) => integration.name !== "BrowserSession"),
  sendClientReports: false,
  maxBreadcrumbs: 0,
  beforeSend: (event) => bereinigeSentryEvent(event, {
    laufzeit: "browser",
    umgebung: process.env.NEXT_PUBLIC_VERCEL_ENV ?? (process.env.NODE_ENV === "development" ? "development" : undefined),
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  }),
  beforeBreadcrumb: () => null,
});
