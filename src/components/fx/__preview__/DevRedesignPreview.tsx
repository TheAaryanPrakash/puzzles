// THROWAWAY — checkpoint-1 visual proof only. Delete this whole __preview__/ folder before the
// Build phase starts; the real adapted components get built fresh at src/components/fx/.
import { useState } from "react";
import FluxLines from "./FluxLines";
import JellyRadio from "./JellyRadio";
import FlipCard from "./FlipCard";
import CodeSlots from "./CodeSlots";
import GlideSelect from "./GlideSelect";
import SpecularButton from "./SpecularButton";
import MagicBento from "./MagicBento";

const PINK = "#df497b";
const PINK_LIGHT = "#f47ba3";
const BG = "#130b0e";
const SURFACE = "#1c1215";
const BORDER = "#874f62";
// A chip/control surface distinct from SURFACE (the card's own background) — components given
// `surfaceColor={SURFACE}` or `slotColor={SURFACE}` rendered correctly but were invisible,
// blending into the card behind them.
const CHIP = "#3c2530";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 220,
      }}
    >
      <div style={{ color: PINK_LIGHT, fontWeight: 700, fontSize: 14 }}>{title}</div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

export function DevRedesignPreview() {
  const [flipped, setFlipped] = useState(false);
  return (
    <div style={{ background: BG, minHeight: "100vh", padding: 40, color: "#f5eaee", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 20, marginBottom: 24 }}>
        React Bits component demos — pink on black (checkpoint 1 proof, not final integration)
      </h1>
      <div
        style={{
          position: "relative",
          height: 220,
          marginBottom: 28,
          borderRadius: 16,
          overflow: "hidden",
          border: `1px solid ${BORDER}`,
        }}
      >
        <FluxLines
          colors={[PINK, PINK_LIGHT, "#f986ac"]}
          speed={0.5}
          backgroundColor={BG}
          transparent={false}
        />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: PINK_LIGHT, fontWeight: 700 }}>
          Flux Lines
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        <Card title="Jelly Radio">
          <JellyRadio
            items={["Off", "Low", "Medium", "High", "Max"]}
            defaultValue="Medium"
            chipColor={SURFACE}
            activeColor={PINK}
            textColor="#f5eaee"
            activeTextColor="#1c0812"
          />
        </Card>

        <Card title="Flip Card">
          <FlipCard
            flipped={flipped}
            onFlipChange={setFlipped}
            width={160}
            height={200}
            background={SURFACE}
            color="#f5eaee"
            front={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", border: `1px solid ${BORDER}`, borderRadius: 12 }}>Wordle</div>}
            back={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", border: `1px solid ${PINK}`, borderRadius: 12, fontSize: 13, padding: 10, textAlign: "center" }}>Guess the word in 6 tries</div>}
          />
        </Card>

        <Card title="Code Slots">
          {/* Numeric-only (digitsOf() strips non-digits) — a letters value like "PINK" yields zero
              digits and renders nothing; use a real code, partially filled to show both states. */}
          <CodeSlots length={5} defaultValue="4821" accentColor={PINK} slotColor={CHIP} digitColor="#f5eaee" />
        </Card>

        <Card title="Glide Select">
          <GlideSelect
            options={["Wordle", "Quordle", "Sudoku", "Zip", "Bee", "Globle"]}
            defaultValue="Wordle"
            accentColor={PINK}
            surfaceColor={CHIP}
            highlightColor={PINK}
            textColor="#f5eaee"
          />
        </Card>

        <Card title="Specular Button">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SpecularButton tint={PINK} baseColor={SURFACE} textColor="#f5eaee">
              Play
            </SpecularButton>
            <SpecularButton tint={PINK} baseColor={PINK} textColor="#1c0812">
              Sign in
            </SpecularButton>
          </div>
        </Card>

        <Card title="Magic Bento (partial — demo content stripped)">
          <div style={{ width: "100%", transform: "scale(0.62)", transformOrigin: "center" }}>
            <MagicBento columns={2} rowHeight={80} gap={10} glowColor={`${PINK}`} theme="dark" />
          </div>
        </Card>
      </div>
    </div>
  );
}
