import * as Sentry from "@sentry/nextjs";
import { bereinigeSentryEvent, sentryDatenminimierung } from "./lib/sentry-privacy";
import { datenschutzIntegration } from "./lib/sentry-integration";

const metadaten = {
  laufzeit: "browser" as const,
  umgebung: process.env.NEXT_PUBLIC_VERCEL_ENV ?? (process.env.NODE_ENV === "development" ? "development" : undefined),
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
};

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  dataCollection: sentryDatenminimierung,
  tracesSampleRate: 0,
  tracePropagationTargets: [],
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  traceLifecycle: "static",
  beforeSendTransaction: () => null,
  beforeSendLog: () => null,
  beforeSendMetric: () => null,
  integrations: (integrations) => [...integrations.filter((integration) => integration.name !== "BrowserSession" && !integration.name.includes("Logging")), datenschutzIntegration(metadaten)],
  sendClientReports: false,
  maxBreadcrumbs: 0,
  beforeSend: (event) => bereinigeSentryEvent(event, metadaten),
  beforeBreadcrumb: () => null,
});
