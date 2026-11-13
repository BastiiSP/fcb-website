/** Nur feste technische Felder verlassen die Anwendung. Freitext und URLs können
 * personenbezogene Daten enthalten und werden deshalb vollständig verworfen. */
interface FrameInput {
  filename?: string;
  abs_path?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
}
interface ExceptionInput {
  type?: string;
  value?: string;
  stacktrace?: { frames?: FrameInput[] };
}
interface EventInput {
  event_id?: string;
  timestamp?: number;
  exception?: { values?: ExceptionInput[] };
}

interface SentryMetadaten {
  laufzeit: "browser" | "server" | "edge";
  umgebung?: string;
  release?: string;
}

const ERROR_TYPES = new Set([
  "Error", "TypeError", "ReferenceError", "RangeError", "SyntaxError",
  "URIError", "EvalError", "AggregateError",
]);

const TEST_CODES = new Set(["FCB_SENTRY_TEST_CLIENT", "FCB_SENTRY_TEST_SERVER"]);

function sichereAssetDatei(frame: FrameInput): string | undefined {
  const candidate = frame.filename ?? frame.abs_path;
  if (!candidate) return undefined;
  // Nur generierte Hash-Dateien zulassen, niemals dynamische Pfade oder Parameter.
  const match = candidate.match(/(?:^|\/)\_next\/static\/chunks\/([a-f0-9]{8,64}\.js)(?:[?#].*)?$/i);
  if (match) return `/_next/static/chunks/${match[1]}`;
  const serverMatch = candidate.match(/(?:^|\/)\.next\/server\/chunks\/(?:ssr\/)?([a-f0-9]{8,64}\.js)(?:[?#].*)?$/i);
  return serverMatch ? `/.next/server/chunks/${serverMatch[1]}` : undefined;
}

export function bereinigeSentryEvent(event: EventInput, metadaten: SentryMetadaten = { laufzeit: "server" }) {
  const values = event.exception?.values?.map((exception) => ({
    type: exception.type && ERROR_TYPES.has(exception.type) ? exception.type : "Error",
    value: exception.value && TEST_CODES.has(exception.value) ? exception.value : "Fehlerdetails aus Datenschutzgründen entfernt",
    stacktrace: exception.stacktrace?.frames
      ? {
          frames: exception.stacktrace.frames.map((frame) => ({
            filename: sichereAssetDatei(frame),
            lineno: typeof frame.lineno === "number" ? frame.lineno : undefined,
            colno: typeof frame.colno === "number" ? frame.colno : undefined,
            in_app: typeof frame.in_app === "boolean" ? frame.in_app : undefined,
          })),
        }
      : undefined,
  }));

  return {
    event_id: event.event_id && /^[a-f0-9]{32}$/i.test(event.event_id) ? event.event_id : undefined,
    timestamp: event.timestamp,
    type: undefined,
    platform: "javascript",
    tags: { laufzeit: metadaten.laufzeit },
    environment: ["production", "preview", "development"].includes(metadaten.umgebung ?? "") ? metadaten.umgebung : undefined,
    release: metadaten.release && /^[a-f0-9]{40}$/i.test(metadaten.release) ? metadaten.release : undefined,
    level: "error" as const,
    exception: values?.length ? { values } : {
      values: [{ type: "Error", value: "Fehlerdetails aus Datenschutzgründen entfernt", stacktrace: undefined }],
    },
  };
}
