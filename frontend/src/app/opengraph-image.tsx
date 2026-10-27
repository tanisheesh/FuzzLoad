import { ImageResponse } from "next/og";

export const alt =
  "FuzzLoad — Adaptive Web Server Load Balancing Using Genetic Programming and Neuro-Fuzzy Control";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#080808",
          padding: "56px 64px",
          border: "12px solid #222220",
          color: "#F2EFE9",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            borderBottom: "2px solid #222220",
            paddingBottom: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                background: "#FF5500",
                color: "#080808",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: "24px",
              }}
            >
              FL
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "0.04em" }}>
                FUZZLOAD
              </span>
              <span style={{ fontSize: "13px", color: "#88857E", letterSpacing: "0.14em" }}>
                SYS.REV.1.0 // GO PROXY + 5-LAYER ANFIS + GENETIC PROGRAMMING
              </span>
            </div>
          </div>

          <div
            style={{
              padding: "8px 18px",
              border: "2px solid #00E676",
              color: "#00E676",
              fontSize: "15px",
              fontWeight: 700,
              letterSpacing: "0.1em",
            }}
          >
            fuzzload.tanisheesh.in
          </div>
        </div>

        {/* Center Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              fontSize: "16px",
              color: "#FF5500",
              fontWeight: 700,
              letterSpacing: "0.2em",
            }}
          >
            ADAPTIVE L7 LOAD BALANCING CONTROL PLANE
          </div>
          <div
            style={{
              fontSize: "72px",
              fontWeight: 900,
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
              color: "#F2EFE9",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>STATIC ROUTING BREAKS</span>
            <span style={{ color: "#FF5500" }}>UNDER TAIL LATENCY.</span>
          </div>
          <div
            style={{
              fontSize: "22px",
              color: "#88857E",
              maxWidth: "920px",
              lineHeight: 1.4,
            }}
          >
            Lock-free Go Reverse Proxy paired with a 5-Layer Takagi-Sugeno Neuro-Fuzzy (ANFIS) Fast Loop and Symbolic Genetic Programming Slow Loop.
          </div>
        </div>

        {/* Bottom KPI Strip */}
        <div
          style={{
            display: "flex",
            width: "100%",
            borderTop: "2px solid #222220",
            paddingTop: "24px",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "34px", fontWeight: 900, color: "#FF5500" }}>&lt; 0.2ms</span>
            <span style={{ fontSize: "12px", color: "#88857E", letterSpacing: "0.1em" }}>
              GO ATOMIC PROXY LOOKUP
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "34px", fontWeight: 900, color: "#00E676" }}>-69.5%</span>
            <span style={{ fontSize: "12px", color: "#88857E", letterSpacing: "0.1em" }}>
              P95 TAIL LATENCY DROP
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "34px", fontWeight: 900, color: "#F2EFE9" }}>500ms</span>
            <span style={{ fontSize: "12px", color: "#88857E", letterSpacing: "0.1em" }}>
              ONLINE ANFIS BACKPROP
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: "20px", fontWeight: 800, color: "#F2EFE9" }}>
              TANISH PODDAR
            </span>
            <span style={{ fontSize: "13px", color: "#88857E" }}>tanisheesh.in</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
