import type { getClient } from "@sentry/nextjs";
import { bereinigeSentryEvent, type SentryMetadaten } from "./sentry-privacy";

// SDK-interne Fehler können beforeSend umgehen; dieser Hook liegt direkt vor
// dem Erstellen des Envelopes und entfernt auch nachträglich gesetzte Anhänge.
export function datenschutzIntegration(metadaten: SentryMetadaten) {
  return {
    name: "Datenschutz",
    setup(client: NonNullable<ReturnType<typeof getClient>>) {
      client.on("beforeSendEvent", (event, hint) => {
        const bereinigt = bereinigeSentryEvent(event, metadaten);
        for (const key of Object.keys(event)) Reflect.deleteProperty(event, key);
        Object.assign(event, bereinigt);
        if (hint) hint.attachments = [];
      });
    },
  };
}
