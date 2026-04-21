import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Subtitle, SubtitleStyle } from "@/lib/subtitle-track";
import { RenderClient } from "./render-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    token?: string;
    w?: string;
    h?: string;
  }>;
}

export default async function RenderPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const workerSecret = process.env.WORKER_SECRET;
  if (!workerSecret || sp.token !== workerSecret) {
    notFound();
  }

  const video = await prisma.videoProject.findUnique({
    where: { id },
    select: {
      id: true,
      subtitles: true,
      subtitleStyle: true,
    },
  });

  if (!video) notFound();

  const subtitles = (video.subtitles ?? []) as unknown as Subtitle[];
  const style = (video.subtitleStyle ?? {}) as unknown as SubtitleStyle;

  const width = sp.w ? parseInt(sp.w, 10) : 1080;
  const height = sp.h ? parseInt(sp.h, 10) : 1920;

  return (
    <RenderClient
      subtitles={subtitles}
      style={style}
      videoWidth={width}
      videoHeight={height}
    />
  );
}
