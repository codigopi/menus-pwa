import { describe, expect, it } from "vitest";
import { FetchError, isPrivateAddress, safeFetch } from "./net";

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.0.0.5", "172.16.3.1", "172.31.255.255", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd12::1", "fe80::1", "::ffff:192.168.1.1"])(
    "%s es privada",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );

  it.each(["8.8.8.8", "151.101.1.69", "172.32.0.1", "2a00:1450:4003:80e::200e"])("%s es pública", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );
});

describe("safeFetch rechaza destinos peligrosos sin conectar", () => {
  it.each([
    "http://127.0.0.1/admin",
    "http://localhost:3000/",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data",
    "file:///etc/passwd",
    "ftp://example.com/x",
    "https://example.com:8443/",
    "no es un enlace",
  ])("%s", async (url) => {
    await expect(safeFetch(url)).rejects.toBeInstanceOf(FetchError);
  });
});
