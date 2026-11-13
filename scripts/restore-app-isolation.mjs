// Strukturprüfung vor dem Einspielen vertraulicher Daten. Ein erfolgreiches
// Ergebnis ersetzt keine aktiven Ausgangs- und Host-Gateway-Negativtests.
export function pruefeInternesNetz(network, erwarteterName) {
  if (!network || network.Name !== erwarteterName || network.Driver !== "bridge" ||
      network.Internal !== true || network.Ingress !== false || typeof network.Id !== "string" || !network.Id) {
    throw new Error("Isoliertes Docker-Netz ist nicht bestätigt.");
  }
}

export function pruefeContainer(container, network, erwarteterName, erwarteteUmgebung, erlaubteMounts = []) {
  pruefeInternesNetz(network, erwarteterName);
  const host = container?.HostConfig;
  const networks = container?.NetworkSettings?.Networks;
  const names = networks && typeof networks === "object" ? Object.keys(networks) : [];
  const ports = host?.PortBindings;
  const extraHosts = host?.ExtraHosts;
  const capabilities = host?.CapAdd;
  const mounts = container?.Mounts;
  const env = container?.Config?.Env;
  if (!host || host.NetworkMode !== network.Name || host.Privileged !== false ||
      host.PidMode === "host" || host.IpcMode === "host" || host.UsernsMode === "host" ||
      names.length !== 1 || names[0] !== network.Name || networks[names[0]]?.NetworkID !== network.Id ||
      (ports && Object.keys(ports).length > 0) || (extraHosts && extraHosts.length > 0) ||
      (capabilities && capabilities.length > 0) || !Array.isArray(mounts) || !Array.isArray(env) ||
      !erwarteteUmgebung || typeof erwarteteUmgebung !== "object" || Array.isArray(erwarteteUmgebung)) {
    throw new Error("Container ist nicht ausschließlich intern isoliert.");
  }
  for (const mount of mounts) {
    if (!erlaubteMounts.some((allowed) => allowed.Type === mount.Type && allowed.Source === mount.Source &&
      allowed.Destination === mount.Destination && allowed.RW === mount.RW)) {
      throw new Error("Nicht erlaubter Container-Mount.");
    }
  }
  const seen = new Set();
  for (const entry of env) {
    const separator = entry.indexOf("=");
    if (separator < 1) throw new Error("Ungültige Container-Umgebung.");
    const name = entry.slice(0, separator);
    const value = entry.slice(separator + 1);
    if (seen.has(name) || !Object.hasOwn(erwarteteUmgebung, name) || erwarteteUmgebung[name] !== value) {
      throw new Error("Nicht erlaubte Container-Umgebung.");
    }
    seen.add(name);
  }
  if (seen.size !== Object.keys(erwarteteUmgebung).length) throw new Error("Erwartete Container-Umgebung fehlt.");
}

// Docker-Container mit gemeinsamem Namespace eines network=none-Ankers haben
// keine eigene NetworkSettings.Networks-Zuordnung. Alle Mounts und Werte
// müssen vom Aufrufer einschließlich der Image-Vorgaben festgelegt sein.
export function pruefeNamespaceContainer(container, anchorId, envAllowed, mountsAllowed = []) {
  const host = container?.HostConfig;
  if (!/^[a-f0-9]{64}$/.test(anchorId) || !host || host.NetworkMode !== `container:${anchorId}` ||
      host.Privileged !== false || host.PidMode === "host" || host.IpcMode === "host" || host.UsernsMode === "host" ||
      (host.PortBindings && Object.keys(host.PortBindings).length) || host.ExtraHosts?.length || host.CapAdd?.length ||
      !Array.isArray(container?.Mounts) || !Array.isArray(container?.Config?.Env)) {
    throw new Error("Container verwendet nicht ausschließlich den isolierten Namespace.");
  }
  if (container.Mounts.length !== mountsAllowed.length || container.Mounts.some((mount) =>
    !mountsAllowed.some((allowed) => allowed.Type === mount.Type && allowed.Source === mount.Source &&
      allowed.Destination === mount.Destination && allowed.RW === mount.RW))) throw new Error("Container-Mount weicht ab.");
  const actual = Object.create(null);
  for (const entry of container.Config.Env) {
    const i = entry.indexOf("=");
    if (i <= 0 || Object.hasOwn(actual, entry.slice(0, i))) throw new Error("Ungültige Container-Umgebung.");
    actual[entry.slice(0, i)] = entry.slice(i + 1);
  }
  const names = Object.keys(envAllowed);
  if (Object.keys(actual).length !== names.length || names.some((name) => actual[name] !== envAllowed[name])) {
    throw new Error("Container-Umgebung weicht ab.");
  }
}
