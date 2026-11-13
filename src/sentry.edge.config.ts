import * as Sentry from "@sentry/nextjs";
import { bereinigeSentryEvent } from "./lib/sentry-privacy";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  enableLogs: false,
  sendClientReports: false,
  maxBreadcrumbs: 0,
  beforeSend: bereinigeSentryEvent,
  beforeBreadcrumb: () => null,
});
