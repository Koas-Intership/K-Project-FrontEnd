// src/pages/Generator.tsx
import { useRef, useState } from "react";
import { makeTokenAuto } from "../utils/crypto";
import { buildPathStyleUrl } from "../utils/url";
import "./Generator.css";

type Row = { product: string; serial: string; token: string; url: string };

export default function Generator() {
    const [product, setProduct] = useState("maron");
    const [serial, setSerial] = useState(""); // 단건 생성용
    const [url, setUrl] = useState("");

    // 대량 생성 옵션 (✅ 4자리 문자열로 관리)
    const [start, setStart] = useState<string>("0001");
    const [end, setEnd] = useState<string>("9999");
    const [concurrency, setConcurrency] = useState<number>(50);

    const [progress, setProgress] = useState(0);
    const [generating, setGenerating] = useState(false);
    const [rows, setRows] = useState<Row[]>([]);
    const cancelRef = useRef(false);

    const base = import.meta.env.VITE_API_BASE as string;

    // 공통: 숫자 → 4자리 문자열(0001 ~ 9999)
    const toSerial4 = (s: string) => {
        const onlyNum = s.replace(/\D/g, "");
        if (!onlyNum) return "";
        return onlyNum.slice(0, 4).padStart(4, "0");
    };

    // === 단건 생성 ===
    async function handleMakeOne() {
        const serial4 = toSerial4(serial.trim());
        if (!serial4 || serial4.length !== 4 || Number(serial4) < 1) {
            alert("serial은 숫자 4자리여야 합니다. (예: 0001)");
            return;
        }
        try {
            const token = await makeTokenAuto(serial4);
            setUrl(buildPathStyleUrl(base, product.trim(), serial4, token));
        } catch (e: any) {
            alert(e?.message || "토큰 생성 실패");
        }
    }

    async function copyOne() {
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            alert("URL을 복사했습니다.");
        } catch (e: any) {
            alert(e?.message || "복사에 실패했습니다.");
        }
    }

    // === 대량 생성 ===
    function escapeCsv(v: string) {
        return `"${String(v).replace(/"/g, '""')}"`;
    }

    async function downloadCsv(result: Row[]) {
        const header = ["product", "serial", "token", "url"].join(",");
        const body = result
            .map((r) => [r.product, r.serial, r.token, r.url].map(escapeCsv).join(","))
            .join("\n");
        const csv = header + "\n" + body;
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `koas_urls_${product}_${start}-${end}.csv`; // ✅ 4자리 표기 유지
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
    }

    async function copyAllUrls(result: Row[]) {
        const all = result.map((r) => r.url).join("\n");
        await navigator.clipboard.writeText(all);
        alert("모든 URL을 클립보드에 복사했습니다.");
    }

    async function generateBulk() {
        const start4 = toSerial4(start);
        const end4 = toSerial4(end);

        if (!start4 || !end4 || start4.length !== 4 || end4.length !== 4) {
            alert("시작/끝 번호는 숫자 4자리여야 합니다. (예: 0001 ~ 9999)");
            return;
        }

        const s = Number(start4);
        const e = Number(end4);

        if (!Number.isFinite(s) || !Number.isFinite(e) || s < 1 || e < s || e > 9999) {
            alert("범위를 올바르게 입력하세요. 예) 0001 ~ 9999, 그리고 시작 ≤ 끝 이어야 합니다.");
            return;
        }

        const total = e - s + 1;

        setGenerating(true);
        setProgress(0);
        setRows([]);
        cancelRef.current = false;

        const nums = Array.from({ length: total }, (_, i) => s + i);
        const results: Row[] = new Array(total);

        let done = 0;
        const pool = Math.max(1, Math.min(concurrency, total));
        let nextIndex = 0;

        async function worker(workerId: number) {
            for (; ;) {
                if (cancelRef.current) return;
                const idx = nextIndex++;
                if (idx >= total) return;

                const n = nums[idx];
                const serial4 = String(n).padStart(4, "0"); // ✅ 4자리 고정
                try {
                    const token = await makeTokenAuto(serial4);
                    const url = buildPathStyleUrl(base, product.trim(), serial4, token);
                    results[idx] = { product: product.trim(), serial: serial4, token, url };
                } catch (err: any) {
                    results[idx] = { product: product.trim(), serial: serial4, token: "ERROR", url: "ERROR" };
                    console.error(`[${workerId}] ${serial4} 실패:`, err?.message || err);
                } finally {
                    done++;
                    if (done % 25 === 0) {
                        setProgress(Math.round((done / total) * 100));
                        await new Promise((r) => setTimeout(r, 0));
                    }
                }
            }
        }

        const workers = Array.from({ length: pool }, (_, i) => worker(i + 1));
        await Promise.all(workers);

        if (cancelRef.current) {
            setGenerating(false);
            setProgress(0);
            alert("생성을 취소했습니다.");
            return;
        }

        setProgress(100);
        setRows(results);
        setGenerating(false);
    }

    function cancel() {
        if (generating) cancelRef.current = true;
    }

    return (
        <div className="gen-root">
            <div className="gen-root">
                <div className="gen-shell">
                    <header className="gen-header">
                        <h1 className="gen-title">QR URL 생성기</h1>
                        <p className="gen-sub">
                            serial을 AES로 암호화하여 token을 만들고, <b>경로형 URL</b>을 조립합니다.
                        </p>
                    </header>

                    <div className="gen-grid">
                        {/* 단건 카드 */}
                        <section className="card">
                            <h3>단건 생성</h3>

                            <div
                                className="row-grid-3-1"
                                style={{ marginBottom: 8, gridTemplateColumns: "1fr" }} // 1열 강제
                            >
                                <div className="field">
                                    <label>product</label>
                                    <input
                                        className="input"
                                        value={product}
                                        onChange={(e) => setProduct(e.target.value)}
                                        placeholder="예: maron"
                                    />
                                </div>

                                <div className="field">
                                    <label>serial</label>
                                    <input
                                        className="input"
                                        type="text"
                                        inputMode="numeric"
                                        pattern="\d*"
                                        maxLength={4}
                                        value={serial}
                                        onChange={(e) => setSerial(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                        placeholder="예: 0001"
                                    />
                                </div>

                                <div className="field">
                                    <label>API BASE</label>
                                    <input className="read" value={base} readOnly />
                                </div>

                                <div>
                                    <button className="btn primary" style={{ width: "100%" }} onClick={handleMakeOne}>
                                        URL 만들기
                                    </button>
                                </div>
                            </div>

                            {url && (
                                <div className="preview-wrap">
                                    <pre className="preview">{url}</pre>
                                    <button
                                        className="btn ghost sm copy-btn"
                                        onClick={copyOne}
                                        aria-label="URL 복사"
                                        title="URL 복사"
                                    >
                                        복사
                                    </button>
                                </div>
                            )}
                        </section>

                        {/* 대량 카드 */}
                        <section className="card">
                            <h3>대량 생성 (예: 0001 ~ 9999)</h3>

                            <div className="row-grid">
                                <div className="field">
                                    <label>시작번호</label>
                                    <input
                                        className="input"
                                        type="text"
                                        inputMode="numeric"
                                        pattern="\d*"
                                        maxLength={4}
                                        value={start}
                                        onChange={(e) => setStart(toSerial4(e.target.value))}
                                        placeholder="0001"
                                    />
                                </div>
                                <div className="field">
                                    <label>끝번호</label>
                                    <input
                                        className="input"
                                        type="text"
                                        inputMode="numeric"
                                        pattern="\d*"
                                        maxLength={4}
                                        value={end}
                                        onChange={(e) => setEnd(toSerial4(e.target.value))}
                                        placeholder="9999"
                                    />
                                </div>
                            </div>

                            <div className="row-grid" style={{ marginTop: 8 }}>
                                <div className="field">
                                    <label>제로패딩(자리수)</label>
                                    <input className="read" value="4 (고정)" readOnly />
                                </div>
                                <div className="field">
                                    <label>동시성</label>
                                    <input
                                        className="input"
                                        type="number"
                                        value={concurrency}
                                        min={1}
                                        max={200}
                                        onChange={(e) => setConcurrency(Number(e.target.value))}
                                    />
                                </div>
                            </div>

                            <div className="field" style={{ marginTop: 8 }}>
                                <label>product</label>
                                <input className="input" value={product} onChange={(e) => setProduct(e.target.value)} />
                            </div>

                            <div className="field" style={{ marginTop: 8 }}>
                                <label>API BASE (읽기전용)</label>
                                <input className="read" value={base} readOnly />
                            </div>

                            <div className="btnbar">
                                <button className="btn primary" disabled={generating} onClick={generateBulk}>
                                    {generating ? "생성 중..." : "범위 생성"}
                                </button>
                                <button className="btn warn" disabled={!generating} onClick={cancel}>
                                    취소
                                </button>
                                <button className="btn ghost" disabled={!rows.length} onClick={() => downloadCsv(rows)}>
                                    CSV 다운로드
                                </button>
                                <button className="btn ghost" disabled={!rows.length} onClick={() => copyAllUrls(rows)}>
                                    모든 URL 복사
                                </button>
                            </div>

                            <div className="progress" aria-label="생성 진행률">
                                <div className="bar">
                                    <div style={{ width: `${progress}%` }} />
                                </div>
                                <div className="muted">{progress}%</div>
                            </div>

                            {rows.length > 0 && (
                                <>
                                    <div className="muted" style={{ marginTop: 12 }}>
                                        총 {rows.length}개 생성됨. 아래는 미리보기(최대 20개).
                                    </div>
                                    <ul className="list">
                                        {rows.slice(0, 20).map((r, i) => (
                                            <li key={i}>{r.url}</li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
