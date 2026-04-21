export interface SubtitleWord {
  word: string;
  start: number;
  end: number;
}

export interface Subtitle {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: SubtitleWord[];
}

export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  position: { x: number; y: number } | string;
  alignment: string;
  outline: boolean;
  outlineColor: string;
  outlineWidth: number;
  highlightColor?: string;
  highlightBg?: string;
  highlightBgOpacity?: number;
  displayMode?: "sentence" | "word-group";
  wordsPerGroup?: number;
  uppercase?: boolean;
  /** Submagic-style word pop animation (word-group mode only). Default: "none". */
  animationMode?: "none" | "pop";
}
