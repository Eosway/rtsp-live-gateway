import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ApiError } from "../errors.js";

interface SsrfGuardOptions {
  allowPrivateIp: boolean;
  allowlist: string[];
  requestAllowPrivateIp: boolean;
}

interface CidrV4 {
  network: number;
  mask: number;
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function parseCidrV4(raw: string): CidrV4 | undefined {
  const [base, bitText] = raw.split("/");
  if (!base || !bitText || isIP(base) !== 4) {
    return undefined;
  }
  const bits = Number.parseInt(bitText, 10);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) {
    return undefined;
  }
  const mask = bits === 0 ? 0 : ((0xffffffff << (32 - bits)) >>> 0);
  return { network: ipv4ToInt(base) & mask, mask };
}

function isPrivateIPv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  const ranges: Array<[number, number]> = [
    [ipv4ToInt("10.0.0.0"), 0xff000000],
    [ipv4ToInt("127.0.0.0"), 0xff000000],
    [ipv4ToInt("169.254.0.0"), 0xffff0000],
    [ipv4ToInt("172.16.0.0"), 0xfff00000],
    [ipv4ToInt("192.168.0.0"), 0xffff0000]
  ];
  return ranges.some(([network, mask]) => (value & mask) === network);
}

function isPrivateIPv6(ip: string): boolean {
  const value = ip.toLowerCase();
  return (
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe80:")
  );
}

function isPrivateIp(ip: string): boolean {
  return isIP(ip) === 4 ? isPrivateIPv4(ip) : isPrivateIPv6(ip);
}

function isHostMatched(host: string, allowlist: string[]): boolean {
  const target = host.toLowerCase();
  return allowlist.some((item) => {
    const normalized = item.toLowerCase();
    if (normalized.startsWith(".")) {
      return target.endsWith(normalized);
    }
    return normalized === target;
  });
}

function isIpAllowedByCidr(ip: string, allowlist: string[]): boolean {
  if (isIP(ip) !== 4) {
    return false;
  }
  const value = ipv4ToInt(ip);
  return allowlist.some((item) => {
    const cidr = parseCidrV4(item);
    if (!cidr) {
      return false;
    }
    return (value & cidr.mask) === cidr.network;
  });
}

export async function assertRtspTargetAllowed(
  rawUrl: string,
  options: SsrfGuardOptions
): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ApiError("INVALID_RTSP_URL", "Invalid RTSP URL");
  }

  if (parsed.protocol !== "rtsp:" && parsed.protocol !== "rtsps:") {
    throw new ApiError("INVALID_RTSP_URL", "Only rtsp/rtsps URL is supported");
  }

  const host = parsed.hostname;
  const hostAllowlisted = isHostMatched(host, options.allowlist);
  const explicitAllowed =
    options.allowPrivateIp || options.requestAllowPrivateIp || hostAllowlisted;

  if (isIP(host)) {
    if (isPrivateIp(host) && !explicitAllowed && !isIpAllowedByCidr(host, options.allowlist)) {
      throw new ApiError("SSRF_BLOCKED", "Private target is blocked");
    }
    return;
  }

  const records = await lookup(host, { all: true }).catch(() => {
    throw new ApiError("INVALID_RTSP_URL", "Cannot resolve RTSP host");
  });

  for (const record of records) {
    if (
      isPrivateIp(record.address) &&
      !explicitAllowed &&
      !isIpAllowedByCidr(record.address, options.allowlist)
    ) {
      throw new ApiError("SSRF_BLOCKED", "Resolved private address is blocked");
    }
  }
}

