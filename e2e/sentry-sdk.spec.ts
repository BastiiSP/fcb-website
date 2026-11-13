import { expect, test } from "@playwright/test";
import * as Sentry from "@sentry/nextjs";
import { datenschutzIntegration } from "../src/lib/sentry-integration";
import { bereinigeSentryEvent, sentryDatenminimierung } from "../src/lib/sentry-privacy";

type SdkOptionen = NonNullable<Parameters<typeof Sentry.init>[0]>;
type SdkTransport = ReturnType<NonNullable<SdkOptionen["transport"]>>;
type SdkEnvelope = Parameters<SdkTransport["send"]>[0];

test("SDK-Transport bereinigt auch interne Fehler und entfernt Anhänge", async () => {
  const marker = "PRIVATE_MARKER_SENTRY_TEST";
  const envelopes: unknown[] = [];
  let beforeSendAufrufe = 0;
  const metadaten = { laufzeit: "server" as const, umgebung: "preview" };

  Sentry.init({
    dsn: "https://public@example.com/1",
    defaultIntegrations: false,
    integrations: [datenschutzIntegration(metadaten)],
    dataCollection: sentryDatenminimierung,
    tracesSampleRate: 0,
    tracePropagationTargets: [],
    sendClientReports: false,
    beforeSendLog: () => null,
    beforeSendMetric: () => null,
    beforeSend: (event) => {
      beforeSendAufrufe += 1;
      return bereinigeSentryEvent(event, metadaten);
    },
    transport: () => ({
      send: async (envelope: SdkEnvelope) => {
        envelopes.push(envelope);
        return { statusCode: 200 };
      },
      flush: async () => true,
    }),
  });

  const client = Sentry.getClient();
  expect(client).toBeDefined();
  if (!client) throw new Error("Sentry-Testclient konnte nicht initialisiert werden.");
  Sentry.setUser({ id: marker, email: marker });
  Sentry.setExtra("privat", marker);
  Sentry.addBreadcrumb({ message: marker });
  Sentry.captureException(new Error(marker), {
    attachments: [{ filename: marker, data: marker }],
  });
  client.captureEvent({
    type: undefined,
    message: marker,
    user: { id: marker, ip_address: marker },
    request: { url: `https://example.com/${marker}?token=${marker}`, headers: { cookie: marker }, data: marker },
    exception: { values: [{ type: "Error", value: marker, stacktrace: { frames: [{ filename: marker, function: marker }] } }] },
    extra: { marker },
    sdk: { name: marker, version: marker, settings: { infer_ip: "auto" } },
  }, { data: { __sentry__: true }, attachments: [{ filename: marker, data: marker }] });
  Sentry.logger.info(marker);
  Sentry.metrics.count(marker, 1);
  await client.flush(2000);
  await client.close(2000);

  expect(beforeSendAufrufe).toBe(1);
  expect(envelopes).toHaveLength(2);
  expect(JSON.stringify(envelopes)).not.toContain(marker);
  for (const envelope of envelopes) {
    const [, items] = envelope as [unknown, Array<[{ type: string }, { sdk?: { settings?: { infer_ip?: string } } }]>];
    expect(items).toHaveLength(1);
    expect(items[0][0].type).toBe("event");
    expect(items[0][1].sdk?.settings?.infer_ip).toBe("never");
  }
});
