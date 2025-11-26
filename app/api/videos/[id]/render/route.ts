import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import path from "path"
import fs from "fs"
import ffmpeg from "fluent-ffmpeg"

interface Subtitle {
  id: number
  start: number
  end: number
  text: string
}

interface SubtitleStyle {
  fontFamily: string
  fontSize: number
  color: string
  backgroundColor: string
  backgroundOpacity: number
  position: string
  alignment: string
  outline: boolean
  outlineColor: string
  outlineWidth: number
}

// Helper function to format time for SRT (HH:MM:SS,mmm)
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.floor((seconds % 1) * 1000)

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`
}

// Helper to generate SRT subtitle file
function generateSRTFile(subtitles: Subtitle[]): string {
  let srtContent = ""

  subtitles.forEach((subtitle, index) => {
    srtContent += `${index + 1}\n`
    srtContent += `${formatSRTTime(subtitle.start)} --> ${formatSRTTime(subtitle.end)}\n`
    srtContent += `${subtitle.text}\n\n`
  })

  return srtContent
}

// Helper to convert hex color to FFmpeg color format (ASS style: &HAABBGGRR)
function hexToFFmpegColor(hex: string, opacity: number = 1): string {
  // Remove # if present
  hex = hex.replace('#', '')

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // ASS Alpha is transparency: 00 = opaque, FF = transparent
  // So we invert the opacity: (1 - opacity)
  const a = Math.round((1 - opacity) * 255)

  // FFmpeg uses format: &HAABBGGRR (note: BGR not RGB)
  const ffmpegColor = `&H${a.toString(16).padStart(2, '0').toUpperCase()}${b.toString(16).padStart(2, '0').toUpperCase()}${g.toString(16).padStart(2, '0').toUpperCase()}${r.toString(16).padStart(2, '0').toUpperCase()}`

  return ffmpegColor
}

// Helper to generate ASS subtitle file (Advanced SubStation Alpha)
function generateASSFile(subtitles: Subtitle[], style: SubtitleStyle): string {
  const primaryColor = hexToFFmpegColor(style.color, 1)
  const outlineColor = hexToFFmpegColor(style.outlineColor, 1)
  const backgroundColor = hexToFFmpegColor(style.backgroundColor, style.backgroundOpacity)

  // Map font family to FFmpeg-compatible names
  const fontMap: Record<string, string> = {
    'Montserrat': 'Montserrat',
    'Arial': 'Arial',
    'Helvetica': 'Helvetica',
    'Inter': 'Inter',
    'Roboto': 'Roboto',
    'Poppins': 'Poppins'
  }

  const fontName = fontMap[style.fontFamily] || 'Arial'

  // Alignment: 1=left bottom, 2=center bottom, 3=right bottom, etc.
  const alignmentMap: Record<string, number> = {
    'left': 1,
    'center': 2,
    'right': 3
  }
  const alignment = alignmentMap[style.alignment] || 2

  let ass = `[Script Info]
Title: Subtitles
ScriptType: v4.00+
Collisions: Normal

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${style.fontSize},${primaryColor},${primaryColor},${outlineColor},${backgroundColor},${style.outline ? -1 : 0},0,0,0,100,100,0,0,1,${style.outlineWidth},0,${alignment},10,10,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

  // Helper to format time for ASS (H:MM:SS.cc)
  function formatASSTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const centiseconds = Math.floor((seconds % 1) * 100)

    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`
  }

  subtitles.forEach((subtitle) => {
    const startTime = formatASSTime(subtitle.start)
    const endTime = formatASSTime(subtitle.end)
    const text = subtitle.text.replace(/\n/g, '\\N') // ASS uses \N for line breaks

    ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${text}\n`
  })

  return ass
}

// POST - Render video with burned-in subtitles
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params

    // Verify ownership
    const video = await prisma.videoProject.findUnique({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      )
    }

    if (!video.subtitles || (video.subtitles as unknown as Subtitle[]).length === 0) {
      return NextResponse.json(
        { error: "No subtitles to render" },
        { status: 400 }
      )
    }

    // Generate SRT subtitle file (simpler and more reliable than ASS)
    const subtitles = video.subtitles as unknown as Subtitle[]
    const srtContent = generateSRTFile(subtitles)
    const srtFileName = `${id}.srt`
    const srtPath = path.join(process.cwd(), "public", "uploads", "subtitles", srtFileName)

    // Ensure subtitles directory exists
    const subtitlesDir = path.dirname(srtPath)
    if (!fs.existsSync(subtitlesDir)) {
      fs.mkdirSync(subtitlesDir, { recursive: true })
    }

    // Write SRT file
    fs.writeFileSync(srtPath, srtContent, 'utf8')

    console.log("SRT file content preview:")
    console.log(srtContent.substring(0, 300))

    // Paths
    const inputVideoPath = path.join(process.cwd(), "public", video.videoUrl)
    const outputFileName = `${id}_rendered.mp4`
    const outputVideoPath = path.join(process.cwd(), "public", "uploads", "rendered", outputFileName)

    // Ensure rendered directory exists
    const renderedDir = path.dirname(outputVideoPath)
    if (!fs.existsSync(renderedDir)) {
      fs.mkdirSync(renderedDir, { recursive: true })
    }

    console.log("Input video:", inputVideoPath)
    console.log("Output video:", outputVideoPath)
    console.log("SRT file path:", srtPath)

    // For Windows: escape path for FFmpeg subtitles filter
    // The subtitles filter needs proper Windows path escaping
    const srtPathForFFmpeg = srtPath
      .replace(/\\/g, '\\\\\\\\')  // Quadruple backslash for Windows
      .replace(/:/g, '\\\\:')      // Escape colons

    console.log("Escaped SRT path for FFmpeg:", srtPathForFFmpeg)

    const defaultStyle: SubtitleStyle = {
      fontFamily: "Arial",
      fontSize: 24,
      color: "#FFFFFF",
      backgroundColor: "#000000",
      backgroundOpacity: 0.8,
      position: "bottom",
      alignment: "center",
      outline: true,
      outlineColor: "#000000",
      outlineWidth: 2
    };

    const savedStyle = (video.subtitleStyle as unknown as SubtitleStyle) || {};
    console.log("Saved Style from DB:", JSON.stringify(savedStyle, null, 2));
    const style = { ...defaultStyle, ...savedStyle };

    // Build subtitle style from user settings
    // Use hexToFFmpegColor to ensure correct BGR format and Alpha
    const primaryColor = hexToFFmpegColor(style.color, 1);
    const backgroundOpacity = typeof style.backgroundOpacity === 'number' ? style.backgroundOpacity : 0.8;
    const borderStyle = backgroundOpacity > 0 ? 3 : 1;

    let outlineColor, backColor;

    if (borderStyle === 3) {
      // Opaque box mode (BorderStyle=3):
      // FFmpeg/ASS uses OutlineColour for the background box color.
      // BackColour is typically unused or for shadow in this mode.
      outlineColor = hexToFFmpegColor(style.backgroundColor ?? '#000000', backgroundOpacity);
      backColor = hexToFFmpegColor(style.outlineColor, 1); // Unused or fallback
    } else {
      // Standard outline mode (BorderStyle=1):
      // OutlineColour is the text outline.
      // BackColour is the shadow/background.
      outlineColor = hexToFFmpegColor(style.outlineColor, 1);
      backColor = hexToFFmpegColor(style.backgroundColor ?? '#000000', backgroundOpacity);
    }

    const fontSize = style.fontSize;
    const outputUrl = `/uploads/rendered/${id}_rendered.mp4`;

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputVideoPath)
        .videoCodec('libx264')
        .audioCodec('copy')
        .outputOptions([
          '-preset', 'ultrafast',
          '-crf', '23',
          `-vf subtitles=${srtPathForFFmpeg}:force_style='FontName=${style.fontFamily},FontSize=${fontSize},PrimaryColour=${primaryColor},OutlineColour=${outlineColor},BackColour=${backColor},BorderStyle=${borderStyle},Outline=${style.outlineWidth}'`
        ])
        .output(outputVideoPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('end', () => {
          console.log('Rendering completed successfully');
          resolve();
        })
        .on('error', (err, stdout, stderr) => {
          console.error('FFmpeg error:', err.message);
          console.error('FFmpeg stderr:', stderr);
          reject(err);
        })
        .run();
    });
    // Update video record with output URL and status
    const updatedVideo = await prisma.videoProject.update({
      where: { id: id },
      data: {
        outputUrl: outputUrl,
        status: "completed"
      }
    });

    return NextResponse.json({
      success: true,
      video: updatedVideo,
      outputUrl: outputUrl
    })
  } catch (error) {
    console.error("Error rendering video:", error)

    // Update status to failed
    try {
      const { id } = await params
      await prisma.videoProject.update({
        where: { id: id },
        data: { status: "failed" }
      })
    } catch (dbError) {
      console.error("Error updating video status:", dbError)
    }

    return NextResponse.json(
      { error: "Failed to render video" },
      { status: 500 }
    )
  }
}

// GET - Download rendered video
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params

    // Verify ownership
    const video = await prisma.videoProject.findUnique({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      )
    }

    if (!video.outputUrl) {
      return NextResponse.json(
        { error: "Video not yet rendered" },
        { status: 400 }
      )
    }

    const videoPath = path.join(process.cwd(), "public", video.outputUrl)

    if (!fs.existsSync(videoPath)) {
      return NextResponse.json(
        { error: "Rendered video file not found" },
        { status: 404 }
      )
    }

    const videoBuffer = fs.readFileSync(videoPath)

    return new NextResponse(videoBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${video.title}_subtitled.mp4"`
      }
    })
  } catch (error) {
    console.error("Error downloading rendered video:", error)
    return NextResponse.json(
      { error: "Failed to download video" },
      { status: 500 }
    )
  }
}
