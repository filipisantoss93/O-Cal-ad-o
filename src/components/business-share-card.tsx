import type { BusinessShareCardData } from "@/lib/share-card-data";

const brandMark = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="86" fill="#172321"/>
    <path fill="#e95e3c" fill-rule="evenodd" d="M256 8C136.7 8 40 104.7 40 224c0 141.3 169.4 252.6 201.4 272.6a27.4 27.4 0 0 0 29.2 0C302.6 476.6 472 365.3 472 224 472 104.7 375.3 8 256 8Zm0 67c82.3 0 149 66.7 149 149s-66.7 149-149 149-149-66.7-149-149S173.7 75 256 75Z"/>
    <path d="M179 182h154c10.5 0 19 8.5 19 19l13 104c1.5 12.1-7.9 22.8-20.1 22.8H167.1c-12.2 0-21.6-10.7-20.1-22.8l13-104c0-10.5 8.5-19 19-19Z" fill="#fffdf8"/>
    <path d="M216 182v-31c0-22.1 17.9-40 40-40s40 17.9 40 40v31" fill="none" stroke="#fffdf8" stroke-width="17" stroke-linecap="round"/>
  </svg>
`)}`;

function businessNameSize(name: string) {
  if (name.length > 76) return 50;
  if (name.length > 52) return 58;
  if (name.length > 32) return 68;
  return 82;
}

export function BusinessShareCard({
  name,
  neighborhood,
  city,
  stateCode,
}: BusinessShareCardData) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
        background: "#f7f5ef",
        color: "#172321",
        padding: "70px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 430,
          height: 430,
          borderRadius: 999,
          background: "#f5c84a",
          right: -205,
          top: -220,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 330,
          height: 330,
          borderRadius: 999,
          border: "58px solid #e95e3c",
          left: -210,
          bottom: -180,
          display: "flex",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          position: "relative",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={brandMark}
          alt=""
          width={92}
          height={92}
          style={{ borderRadius: 20 }}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 38,
              lineHeight: 1,
              fontWeight: 800,
              letterSpacing: -1.4,
            }}
          >
            O Calçadão
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 10,
              fontSize: 22,
              color: "#64716e",
              fontWeight: 600,
            }}
          >
            Seu Centro Comercial
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            borderRadius: 999,
            background: "#172321",
            color: "white",
            padding: "13px 24px",
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 2.3,
          }}
        >
          NOVIDADE NA CIDADE
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 34,
            fontSize: 37,
            lineHeight: 1.2,
            color: "#263b37",
            fontWeight: 600,
          }}
        >
          Agora você também encontra
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 14,
            maxWidth: 920,
            fontSize: businessNameSize(name),
            lineHeight: 1.02,
            letterSpacing: -2.8,
            fontWeight: 900,
            color: "#b93d25",
            wordBreak: "break-word",
          }}
        >
          {name}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 22,
            fontSize: 33,
            lineHeight: 1.2,
            fontWeight: 750,
          }}
        >
          no O Calçadão
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontSize: 23,
            color: "#64716e",
            fontWeight: 650,
          }}
        >
          {neighborhood} · {city} — {stateCode}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
          width: "100%",
          borderRadius: 28,
          background: "#e95e3c",
          color: "white",
          padding: "28px 34px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 25, fontWeight: 800 }}>
            Conheça a vitrine
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 7,
              fontSize: 20,
              color: "#fff5ec",
              fontWeight: 600,
            }}
          >
            ocalcadao.com.br
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 62,
            height: 62,
            borderRadius: 999,
            background: "white",
            color: "#b93d25",
            fontSize: 35,
            fontWeight: 900,
          }}
        >
          →
        </div>
      </div>
    </div>
  );
}
