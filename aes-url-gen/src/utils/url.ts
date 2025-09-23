export function buildPathStyleUrl(base: string, product: string, serial: string, token: string): string {
    base = base.replace(/\/$/, "");
    return `${base}/api/qr/check/${encodeURIComponent(product)}/serial=${encodeURIComponent(serial)}&token=${encodeURIComponent(token)}`;
}