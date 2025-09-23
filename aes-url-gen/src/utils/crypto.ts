// HEX/Base64/ASCII 자동 파싱 + IV 길이로 모드 자동(AES-GCM: 12, AES-CBC: 16)
const te = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const isHex = (s: string) => /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0;

function hexToBytes(hex: string): Uint8Array {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
}

function b64ToBytes(b64: string): Uint8Array {
    const norm = b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4);
    const bin = atob(norm);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function asciiToBytes(s: string): Uint8Array {
    return new TextEncoder().encode(s); // ASCII/UTF-8
}

function parseKeyAuto(raw: string): Uint8Array {
    if (!raw) throw new Error("VITE_AES_KEY가 비었습니다..");
    // 1) HEX
    if (isHex(raw)) {
        const k = hexToBytes(raw);
        if ([16, 24, 32].includes(k.length)) return k;
    }
    // 2) Base64
    try {
        const k = b64ToBytes(raw);
        if ([16, 24, 32].includes(k.length)) return k;
    } catch { }
    // 3) ASCII (문자 그대로 바이트)
    const k = asciiToBytes(raw);
    if ([16, 24, 32].includes(k.length)) return k;

    throw new Error(`AES 키 길이가 부적절합니다: ${k.length} (허용: 16/24/32 바이트)`);
}

function parseIvAuto(raw: string): Uint8Array {
    if (!raw) throw new Error("VITE_AES_IV가 비었습니다.");
    // 1) HEX
    if (isHex(raw)) {
        const iv = hexToBytes(raw);
        if (iv.length === 12 || iv.length === 16) return iv;
    }
    // 2) Base64
    try {
        const iv = b64ToBytes(raw);
        if (iv.length === 12 || iv.length === 16) return iv;
    } catch { }
    // 3) ASCII
    const iv = asciiToBytes(raw);
    if (iv.length === 12 || iv.length === 16) return iv;

    throw new Error(`IV 길이가 맞지 않습니다.: ${iv.length} (허용: 12[GCM], 16[CBC])`);
}

/** IV 길이로 자동 결정: 12=GCM, 16=CBC */
export async function makeTokenAuto(plain: string): Promise<string> {
    if (!("crypto" in globalThis) || !("subtle" in crypto)) {
        throw new Error("Web Crypto 사용 불가 환경입니다.(HTTPS 또는 localhost에서 실행).");
    }

    const keyBytes = parseKeyAuto(import.meta.env.VITE_AES_KEY as string);
    const ivBytes = parseIvAuto(import.meta.env.VITE_AES_IV as string);

    if (ivBytes.length === 12) {
        // AES-GCM
        const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
        const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: ivBytes, tagLength: 128 }, key, te.encode(plain));
        const packed = new Uint8Array(ivBytes.length + (ct as ArrayBuffer).byteLength);
        packed.set(ivBytes, 0); packed.set(new Uint8Array(ct), ivBytes.length);
        return toBase64Url(packed);
    }

    if (ivBytes.length === 16) {
        // AES-CBC
        const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["encrypt"]);
        const ct = await crypto.subtle.encrypt({ name: "AES-CBC", iv: ivBytes }, key, te.encode(plain));
        const packed = new Uint8Array(ivBytes.length + (ct as ArrayBuffer).byteLength);
        packed.set(ivBytes, 0); packed.set(new Uint8Array(ct), ivBytes.length);
        return toBase64Url(packed);
    }

    throw new Error("IV 길이 판단 실패");
}
