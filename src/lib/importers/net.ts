/**
 * Descarga de páginas externas con protecciones básicas:
 *  - Solo http/https y puertos estándar.
 *  - Bloquea direcciones privadas/locales (SSRF): nadie puede usar el
 *    importador para sondear la red interna del servidor (p. ej. Dokploy).
 *  - Sigue redirecciones a mano, revalidando cada salto.
 *  - Límite de tiempo y de tamaño.
 *
 * Limitación conocida: entre la comprobación DNS y la conexión podría haber
 * un cambio de DNS (DNS rebinding). Para una app doméstica es aceptable.
 */
import dns from "node:dns/promises";
import net from "node:net";

export class FetchError extends Error {}

const BROWSER_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

/** ¿Es una IP privada, local, de enlace local, multicast o reservada? */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // enlace local / metadatos cloud
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast y reservadas
    );
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") || // fc00::/7
      /^fe[89ab]/.test(lower) || // fe80::/10
      lower.startsWith("ff") // multicast
    );
  }
  return true; // si no es una IP reconocible, por prudencia la bloqueamos
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new FetchError("Solo se admiten enlaces http(s)");
  if (url.port && url.port !== "80" && url.port !== "443") throw new FetchError("Puerto no permitido");
  if (url.username || url.password) throw new FetchError("Enlace no permitido");

  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new FetchError("No se encuentra esa web");
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new FetchError("Enlace no permitido");
}

export interface SafeFetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface FetchedResource {
  url: string; // URL final tras redirecciones
  contentType: string;
  body: Buffer;
}

export async function safeFetch(input: string, opts: SafeFetchOptions = {}): Promise<FetchedResource> {
  const { maxBytes = 3 * 1024 * 1024, timeoutMs = 12_000, headers = {} } = opts;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new FetchError("El enlace no es válido");
  }

  const signal = AbortSignal.timeout(timeoutMs);
  for (let hop = 0; hop < 6; hop++) {
    await assertPublicUrl(url);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal,
        headers: { "User-Agent": BROWSER_UA, "Accept-Language": "es-ES,es;q=0.9", ...headers },
      });
    } catch (err) {
      if (signal.aborted) throw new FetchError("La web tardó demasiado en responder");
      throw new FetchError(`No se pudo abrir el enlace (${(err as Error).message})`);
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok) throw new FetchError(`La web respondió con un error (${res.status})`);

    // Lectura con tope de tamaño
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          break; // nos quedamos con lo leído: para HTML suele bastar
        }
        chunks.push(value);
      }
    }
    return {
      url: url.toString(),
      contentType: res.headers.get("content-type") ?? "",
      body: Buffer.concat(chunks),
    };
  }
  throw new FetchError("Demasiadas redirecciones");
}
