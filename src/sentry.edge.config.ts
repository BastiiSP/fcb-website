import * as Sentry from "@sentry/nextjs";
import { bereinigeSentryEvent, sentryDatenminimierung } from "./lib/sentry-privacy";
import { datenschutzIntegration } from "./lib/sentry-integration";

const metadaten = {
  laufzeit: "edge" as const,
  umgebung: process.env.VERCEL_ENV ?? (process.env.NODE_ENV === "development" ? "development" : undefined),
  release: process.env.VERCEL_GIT_COMMIT_SHA,
};

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  dataCollection: sentryDatenminimierung,
  tracesSampleRate: 0,
  tracePropagationTargets: [],
  integrations: (integrations) => [...integrations.filter((integration) => !integration.name.includes("Logging")), datenschutzIntegration(metadaten)],
  traceLifecycle: "static",
  beforeSendTransaction: () => null,
  beforeSendLog: () => null,
  beforeSendMetric: () => null,
  sendClientReports: false,
  maxBreadcrumbs: 0,
  beforeSend: (event) => bereinigeSentryEvent(event, metadaten),
  beforeBreadcrumb: () => null,
});
