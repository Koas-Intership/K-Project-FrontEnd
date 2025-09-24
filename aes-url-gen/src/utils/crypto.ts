// utils/crypto.ts
import CryptoJS from "crypto-js";

const KEY_STR = import.meta.env.VITE_AES_KEY as string;
const IV_STR = import.meta.env.VITE_AES_IV as string;
if (!KEY_STR) throw new Error("VITE_AES_KEY 없음");
if (!IV_STR) throw new Error("VITE_AES_IV 없음");

// CryptoJS 키/IV 객체
const KEY = CryptoJS.enc.Utf8.parse(KEY_STR);
const IV = CryptoJS.enc.Utf8.parse(IV_STR);

// Base64 ⇄ Base64URL 변환
function toB64Url(b64: string) {
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromB64Url(u: string) {
    const b64 = u.replace(/-/g, "+").replace(/_/g, "/");
    return b64 + "===".slice((b64.length + 3) % 4);
}

// 🔒 암호화 → URL-safe Base64 반환 (백엔드와 동일 포맷)
export function makeTokenUrlSafe(plain: string): string {
    const enc = CryptoJS.AES.encrypt(plain, KEY, {
        iv: IV,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
    });
    return toB64Url(enc.toString()); // 표준 Base64 → Base64URL
}

// 🔓 복호화 (URL-safe Base64 입력)
export function decryptTokenUrlSafe(tokenUrlB64: string): string {
    const tokenB64 = fromB64Url(tokenUrlB64);
    const dec = CryptoJS.AES.decrypt(tokenB64, KEY, {
        iv: IV,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
    });
    return CryptoJS.enc.Utf8.stringify(dec);
}


/*
    // 🔒 암호화 (URL-safe Base64)
    public String encrypt(String data) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        SecretKeySpec keySpec = new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "AES");
        IvParameterSpec ivSpec = new IvParameterSpec(iv.getBytes(StandardCharsets.UTF_8));

        cipher.init(Cipher.ENCRYPT_MODE, keySpec, ivSpec);
        byte[] encrypted = cipher.doFinal(data.getBytes(StandardCharsets.UTF_8));

        // URL-safe Base64 인코딩
        return Base64.getUrlEncoder().withoutPadding().encodeToString(encrypted);
    }

    // 🔓 복호화 (URL-safe Base64)
    public String decrypt(String encrypted) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        SecretKeySpec keySpec = new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "AES");
        IvParameterSpec ivSpec = new IvParameterSpec(iv.getBytes(StandardCharsets.UTF_8));

        cipher.init(Cipher.DECRYPT_MODE, keySpec, ivSpec);

        // URL-safe Base64 디코딩
        byte[] decodedBytes = Base64.getUrlDecoder().decode(encrypted);
        byte[] decrypted = cipher.doFinal(decodedBytes);

        return new String(decrypted, StandardCharsets.UTF_8);
    }

*/