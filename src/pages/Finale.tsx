import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import confetti from "canvas-confetti";
import { SiteHeader } from "../components/SiteHeader";
import { dataSource } from "../lib/data";
import { getSupabaseClient } from "../lib/data/supabase";
import { celebrate } from "../lib/celebrate";
import type { FinaleMessage } from "../lib/data/types";

const usesSupabase = import.meta.env.VITE_DATA_SOURCE === "supabase";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // an hour is plenty for one viewing of one page

/** A bigger, longer moment than the one-shot burst every game's own win uses (`celebrate()`) —
 *  this page only happens once a year. Two more bursts from the bottom corners, staggered, so it
 *  reads as a single sustained celebration rather than three separate ones. */
function bigCelebration(): void {
  celebrate();
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const shared = { particleCount: 90, spread: 100, startVelocity: 55 };
  setTimeout(() => void confetti({ ...shared, origin: { x: 0.1, y: 0.8 }, angle: 60 }), 250);
  setTimeout(() => void confetti({ ...shared, origin: { x: 0.9, y: 0.8 }, angle: 120 }), 450);
}

/** Resolves each Storage-relative path (e.g. `<user-id>/photo.jpg`) to a short-lived signed URL.
 *  The "finale" bucket is private — "recipient reads own unlocked finale files"
 *  (0003_finale_storage.sql) is what actually lets this succeed, not anything client-side. */
async function resolveAssetUrls(paths: string[]): Promise<string[]> {
  if (!usesSupabase || paths.length === 0) return [];
  const db = getSupabaseClient();
  const urls = await Promise.all(
    paths.map(async (path) => {
      const { data, error } = await db.storage.from("finale").createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (error || !data) return null;
      return data.signedUrl;
    }),
  );
  return urls.filter((u): u is string => u !== null);
}

type LoadState = "loading" | "none" | "ready";

export function Finale() {
  const [state, setState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<FinaleMessage | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const m = await dataSource.getMessage();
      if (cancelled) return;
      if (!m) {
        setState("none");
        return;
      }
      setMessage(m);
      const [photos, [video]] = await Promise.all([
        resolveAssetUrls(m.photos),
        resolveAssetUrls(m.video ? [m.video] : []),
      ]);
      if (cancelled) return;
      setPhotoUrls(photos);
      setVideoUrl(video ?? null);
      setState("ready");
      bigCelebration();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const container = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: reduceMotion ? 0 : 0.18 } },
  };
  const item = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: reduceMotion
        ? { duration: 0.2 }
        : { type: "spring" as const, stiffness: 260, damping: 24 },
    },
  };

  return (
    <div className="min-h-screen bg-brand-bg">
      <SiteHeader backTo="/" />
      <main className="mx-auto flex min-h-[calc(100vh-61px)] max-w-lg flex-col items-center justify-center gap-5 p-6 text-center">
        {state === "loading" && null}

        {state === "none" && (
          <div>
            <p className="font-brand text-lg font-semibold text-brand-fg">Not quite yet</p>
            <p className="mt-1 text-sm text-brand-muted">
              Come back after you’ve played a few more games today.
            </p>
          </div>
        )}

        {state === "ready" && message && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={container}
            className="flex flex-col items-center gap-5"
          >
            <motion.span variants={item} aria-hidden className="text-6xl">
              🎁
            </motion.span>

            <motion.h1
              variants={item}
              className="text-balance font-brand text-3xl font-bold text-brand-fg"
            >
              {message.title}
            </motion.h1>

            <motion.p variants={item} className="text-pretty text-brand-fg">
              {message.body}
            </motion.p>

            {photoUrls.length > 0 && (
              <motion.div variants={item} className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
                {photoUrls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="aspect-square w-full rounded-brand-md object-cover shadow-brand-sm"
                  />
                ))}
              </motion.div>
            )}

            {videoUrl && (
              <motion.video
                variants={item}
                src={videoUrl}
                controls
                className="w-full rounded-brand-md shadow-brand-sm"
              />
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}
