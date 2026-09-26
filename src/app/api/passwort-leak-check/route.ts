export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const prefix = new URL(request.url).searchParams.get("prefix");

  if (!prefix || prefix.length !== 5 || !/^[0-9a-f]{5}$/i.test(prefix)) {
    return Response.json(
      { fehler: "Das Präfix muss aus genau fünf Hex-Zeichen bestehen." },
      { status: 400 },
    );
  }

  try {
    // Der Proxy schützt die Nutzer-IP vor dem Drittanbieter (DSGVO);
    // der Browser bleibt beim eigenen Ursprung und CSP connect-src unverändert.
    const antwort = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix.toUpperCase()}`,
      {
        headers: {
          "Add-Padding": "true",
          "User-Agent": "vereins-webapp-leak-check",
        },
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
      },
    );

    if (!antwort.ok) {
      throw new Error("Der Passwort-Leak-Dienst ist nicht erreichbar.");
    }

    return new Response(await antwort.text(), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    const fehler = "Die Passwort-Leak-Prüfung ist derzeit nicht verfügbar.";
    // Keine fremden Fehlerdetails protokollieren: Sie könnten die Anfrage-URL enthalten.
    console.warn(fehler);
    return Response.json({ fehler }, { status: 502 });
  }
}
