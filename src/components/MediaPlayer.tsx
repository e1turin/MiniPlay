"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Play,
  Pause,
  Rewind,
  FastForward,
  SkipBack,
  SkipForward,
  Gauge,
  Volume2,
  VolumeX,
  Volume1,
  Music,
  PictureInPicture2,
  FolderOpen,
  X,
  Folder,
  Plus,
  ListMusic,
  GripVertical,
} from "lucide-react";
import { parseBlob } from "music-metadata";

/* ---------- Types ---------- */

interface PlaylistItem {
  id: string;
  file: File;
  name: string;
  isVideo: boolean;
  albumArt?: string; // data URL of extracted album art
}

/* ---------- Sortable Item ---------- */

function SortablePlaylistItem({
  item,
  isActive,
  onSelect,
  onRemove,
}: {
  item: PlaylistItem;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1 px-2 py-1.5 rounded-md group cursor-pointer transition-colors ${
        isActive
          ? "bg-[#7c3aed]/20 text-white"
          : "text-white/50 hover:bg-white/5 hover:text-white/80"
      }`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-white/20 hover:text-white/40 shrink-0"
      >
        <GripVertical className="w-3 h-3" />
      </div>

      {/* Track info - click to play */}
      <button
        onClick={onSelect}
        className="flex-1 text-left min-w-0 flex items-center gap-1.5"
      >
        {item.isVideo ? (
          <PictureInPicture2 className="w-3 h-3 shrink-0 opacity-50" />
        ) : (
          <Music className="w-3 h-3 shrink-0 opacity-50" />
        )}
        <span className="text-[11px] truncate">{item.name}</span>
      </button>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-opacity shrink-0"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

/* ---------- Main Component ---------- */

const SPEED_PRESETS = [0.5, 1, 1.5, 2];

/* ---------- Album Art Extraction ---------- */

async function extractAlbumArt(file: File): Promise<string | null> {
  try {
    const metadata = await parseBlob(file);
    const pictures = metadata.common.picture;
    if (pictures && pictures.length > 0) {
      const pic = pictures[0];
      // Convert the picture data to a base64 data URL
      const uint8 = pic.data;
      let binary = "";
      for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      return `data:${pic.format};base64,${btoa(binary)}`;
    }
  } catch (err) {
    // Many files won't have embedded art — this is non-essential
    console.debug("No album art extracted:", (err as Error)?.message ?? err);
  }
  return null;
}

export default function MediaPlayer() {
  // Playlist state
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [showSidebar, setShowSidebar] = useState(false);

  // Tracks whether the user explicitly requested playback (vs. auto-play on add)
  const shouldAutoPlayRef = useRef(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Current playlist item
  const currentItem = currentIndex >= 0 && currentIndex < playlist.length
    ? playlist[currentIndex]
    : null;

  const currentFileName = currentItem?.name ?? "";

  // Close speed menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) {
        setShowSpeedMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ---------- Playlist helpers ----------

  const addFilesToPlaylist = useCallback((files: File[]) => {
    const mediaFiles = files.filter(
      (f) => f.type.startsWith("audio/") || f.type.startsWith("video/")
    );
    if (mediaFiles.length === 0) return;

    const newItems: PlaylistItem[] = mediaFiles.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file: f,
      name: f.name.replace(/\.[^/.]+$/, ""),
      isVideo: f.type.startsWith("video/"),
    }));

    setPlaylist((prev) => {
      const updated = [...prev, ...newItems];
      // If nothing was playing, set the first new item as current but do NOT auto-play
      if (prev.length === 0) {
        setCurrentIndex(0);
        shouldAutoPlayRef.current = false; // Don't auto-play on first add
      }
      return updated;
    });

    // Asynchronously extract embedded album art for audio files
    for (const item of newItems) {
      if (!item.isVideo) {
        extractAlbumArt(item.file).then((art) => {
          if (art) {
            setPlaylist((prev) =>
              prev.map((p) => (p.id === item.id ? { ...p, albumArt: art } : p))
            );
          }
        });
      }
    }
  }, []);

  // Play a specific track by index — lazy loads the media
  // Callers must set shouldAutoPlayRef.current BEFORE calling this to control auto-play behavior
  const playTrack = useCallback((index: number) => {
    if (index < 0) return;

    setPlaylist((prev) => {
      if (index >= prev.length) return prev;

      setCurrentIndex(index);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setPlaybackSpeed(1);
      // shouldAutoPlayRef is set by the caller based on context

      return prev;
    });
  }, []);

  // Remove item from playlist
  const removeFromPlaylist = useCallback(
    (id: string) => {
      setPlaylist((prev) => {
        const removeIndex = prev.findIndex((item) => item.id === id);
        if (removeIndex === -1) return prev;

        const updated = prev.filter((item) => item.id !== id);

        // Adjust currentIndex
        setCurrentIndex((prevIdx) => {
          if (removeIndex < prevIdx) {
            return prevIdx - 1;
          } else if (removeIndex === prevIdx) {
            // Current track removed
            if (updated.length === 0) {
              setIsPlaying(false);
              return -1;
            }
            // If currently playing, auto-play the replacement track
            shouldAutoPlayRef.current = true; // was already playing, continue
            return removeIndex < updated.length ? removeIndex : updated.length - 1;
          }
          return prevIdx;
        });

        return updated;
      });
    },
    []
  );

  // DnD reorder
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setPlaylist((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id);
      const newIndex = prev.findIndex((i) => i.id === over.id);
      const updated = arrayMove(prev, oldIndex, newIndex);

      // Update currentIndex to follow the currently playing item
      setCurrentIndex((prevIdx) => {
        if (prevIdx === oldIndex) return newIndex;
        if (prevIdx > oldIndex && prevIdx <= newIndex) return prevIdx - 1;
        if (prevIdx < oldIndex && prevIdx >= newIndex) return prevIdx + 1;
        return prevIdx;
      });

      return updated;
    });
  }, []);

  // ---------- File loading ----------

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) addFilesToPlaylist(files);
      e.target.value = "";
    },
    [addFilesToPlaylist]
  );

  const handleFolderSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) addFilesToPlaylist(files);
      e.target.value = "";
    },
    [addFilesToPlaylist]
  );

  // Drag and drop from OS
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) addFilesToPlaylist(files);
    },
    [addFilesToPlaylist]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    fileInputRef.current?.click();
  }, []);

  // ---------- Playback controls ----------

  const handlePlayPause = useCallback(() => {
    if (!mediaRef.current || !currentItem) return;
    if (isPlaying) {
      mediaRef.current.pause();
    } else {
      mediaRef.current.play().catch(() => {});
    }
    // isPlaying state is updated by onPlay/onPause callbacks from the media element
  }, [isPlaying, currentItem]);

  const handleSkipBack = useCallback(() => {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = Math.max(0, mediaRef.current.currentTime - 10);
  }, []);

  const handleSkipForward = useCallback(() => {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = Math.min(
      mediaRef.current.duration,
      mediaRef.current.currentTime + 10
    );
  }, []);

  // Playlist prev / next — auto-play only if currently playing
  const handlePrevTrack = useCallback(() => {
    if (currentIndex > 0) {
      shouldAutoPlayRef.current = isPlaying;
      playTrack(currentIndex - 1);
    }
  }, [currentIndex, playTrack, isPlaying]);

  const handleNextTrack = useCallback(() => {
    if (currentIndex < playlist.length - 1) {
      shouldAutoPlayRef.current = isPlaying;
      playTrack(currentIndex + 1);
    }
  }, [currentIndex, playlist.length, playTrack, isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    if (!mediaRef.current) return;
    setCurrentTime(mediaRef.current.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (!mediaRef.current) return;
    setDuration(mediaRef.current.duration);
    // Only auto-play if explicitly requested (track switch, prev/next, auto-advance)
    // NOT when a file is first added to playlist
    if (shouldAutoPlayRef.current) {
      mediaRef.current.play().catch(() => {});
      shouldAutoPlayRef.current = false;
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    if (mediaRef.current) mediaRef.current.playbackRate = speed;
    setShowSpeedMenu(false);
  }, []);

  const handleSpeedSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const speed = parseFloat(e.target.value);
      setPlaybackSpeed(speed);
      if (mediaRef.current) mediaRef.current.playbackRate = speed;
    },
    []
  );

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const vol = parseFloat(e.target.value);
      setVolume(vol);
      if (mediaRef.current) {
        mediaRef.current.volume = vol;
        mediaRef.current.muted = vol === 0;
      }
      setIsMuted(vol === 0 ? true : vol === 0 ? false : isMuted ? false : isMuted);
      if (vol > 0 && isMuted) setIsMuted(false);
      if (vol === 0) setIsMuted(true);
    },
    [isMuted]
  );

  const toggleMute = useCallback(() => {
    if (!mediaRef.current) return;
    if (isMuted) {
      mediaRef.current.muted = false;
      setIsMuted(false);
    } else {
      mediaRef.current.muted = true;
      setIsMuted(true);
    }
  }, [isMuted]);

  // PiP
  const handlePiP = useCallback(async () => {
    if (!mediaRef.current || !(mediaRef.current instanceof HTMLVideoElement)) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await mediaRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error("PiP failed:", err);
    }
  }, []);

  const handleMediaPreviewClick = useCallback(() => {
    if (currentItem?.isVideo) handlePiP();
  }, [currentItem, handlePiP]);

  // Auto-advance on track end — always auto-play next
  const handleMediaEnded = useCallback(() => {
    if (currentIndex < playlist.length - 1) {
      shouldAutoPlayRef.current = true;
      playTrack(currentIndex + 1);
    } else {
      // Last track - stop
      setIsPlaying(false);
      setCurrentTime(0);
      if (mediaRef.current) mediaRef.current.currentTime = 0;
    }
  }, [currentIndex, playlist.length, playTrack]);

  // ---------- Keyboard shortcuts ----------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.code) {
        case "Space":
          e.preventDefault();
          if (currentItem) handlePlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handleSkipBack();
          break;
        case "ArrowRight":
          e.preventDefault();
          handleSkipForward();
          break;
        case "KeyM":
          toggleMute();
          break;
        case "KeyO":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
          break;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handlePlayPause, handleSkipBack, handleSkipForward, toggleMute, currentItem]);

  // Handle "Open With" file handler
  useEffect(() => {
    if ("launchQueue" in window) {
      const launchQueue = (window as any).launchQueue;
      launchQueue?.setConsumer?.(async (launchParams: any) => {
        for (const fileHandle of launchParams.files) {
          const file = await fileHandle.getFile();
          addFilesToPlaylist([file]);
          break;
        }
      });
    }
  }, [addFilesToPlaylist]);

  // ---------- Helpers ----------

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  // Lazy-load: create object URL only when currentItem changes
  // Cleanup of old URLs happens in this effect
  const currentMediaUrl = useMemo(() => {
    if (!currentItem) return "";
    return URL.createObjectURL(currentItem.file);
  }, [currentItem]);

  // Revoke old URL when it changes
  const prevUrlRef = useRef<string>("");
  useEffect(() => {
    if (prevUrlRef.current && prevUrlRef.current !== currentMediaUrl) {
      URL.revokeObjectURL(prevUrlRef.current);
    }
    prevUrlRef.current = currentMediaUrl;
  }, [currentMediaUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
      }
    };
  }, []);

  const hasMedia = !!currentItem;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < playlist.length - 1;

  return (
    <div
      className="w-full h-full bg-black flex overflow-hidden select-none relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
    >
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        accept="audio/*,video/*"
        multiple
        // @ts-expect-error webkitdirectory is not in React types
        webkitdirectory=""
        onChange={handleFolderSelect}
        className="hidden"
      />

      {/* -------- Playlist Sidebar -------- */}
      {showSidebar && (
        <div className="w-44 h-full bg-[#0a0a0b] border-r border-white/5 flex flex-col shrink-0 z-20">
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-2 h-7 shrink-0 border-b border-white/5">
            <span className="text-[10px] text-white/30 font-medium uppercase tracking-wider">
              Playlist
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
                title="Add files"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                onClick={() => folderInputRef.current?.click()}
                className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
                title="Add folder"
              >
                <Folder className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Playlist items */}
          <div className="flex-1 overflow-y-auto py-1 px-1">
            {playlist.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/50 gap-1">
                <ListMusic className="w-5 h-5" />
                <span className="text-[9px]">Empty playlist</span>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={playlist.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {playlist.map((item, index) => (
                    <SortablePlaylistItem
                      key={item.id}
                      item={item}
                      isActive={index === currentIndex}
                      onSelect={() => {
                        shouldAutoPlayRef.current = isPlaying;
                        playTrack(index);
                      }}
                      onRemove={() => removeFromPlaylist(item.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Track count */}
          {playlist.length > 0 && (
            <div className="px-2 py-1 border-t border-white/5 text-[9px] text-white/45 text-center">
              {playlist.length} track{playlist.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* -------- Main Player Area -------- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Title bar */}
        <div className="flex items-center h-7 shrink-0 app-drag-region">
          {/* Left: menu + add buttons */}
          <div className="flex items-center app-no-drag pl-2 gap-0.5">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className={`p-1 rounded hover:bg-white/10 transition-colors ${
                showSidebar ? "text-[#7c3aed]" : "text-white/60 hover:text-white/85"
              }`}
              title="Toggle playlist"
            >
              <ListMusic className="w-3 h-3" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 rounded hover:bg-white/10 text-white/55 hover:text-white/75 transition-colors"
              title="Add to playlist (⌘O)"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Center: file name */}
          <div className="flex-1 text-center app-drag-region">
            {currentFileName && (
              <span className="text-[10px] text-white/60 truncate max-w-[200px] inline-block align-middle">
                {currentFileName}
              </span>
            )}
          </div>

          {/* Right: volume control */}
          <div
            ref={volumeRef}
            className="flex items-center app-no-drag pr-2"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <div
              className={`flex items-center mr-1 transition-all duration-200 overflow-hidden ${
                showVolumeSlider ? "w-20 opacity-100" : "w-0 opacity-0"
              }`}
            >
              <div className="bg-white/8 rounded px-2 py-1 flex items-center">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1"
                    disabled={!hasMedia}
                  />
                </div>
            </div>
            <button
              onClick={toggleMute}
              disabled={!hasMedia}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-white/60 hover:text-white/85"
              title={isMuted ? "Unmute (M)" : "Mute (M)"}
            >
              <VolumeIcon className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Media Preview Area */}
        <div
          className={`flex-1 flex items-center justify-center relative overflow-hidden transition-colors duration-200 ${
            currentItem?.isVideo ? "cursor-pointer" : ""
          } ${isDragOver ? "bg-[#7c3aed]/5 ring-2 ring-inset ring-[#7c3aed]/40" : ""}`}
          onClick={handleMediaPreviewClick}
        >
          {currentItem ? (
            <>
              {currentItem.isVideo ? (
                <video
                  key={currentMediaUrl}
                  ref={mediaRef as React.RefObject<HTMLVideoElement>}
                  src={currentMediaUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={handleMediaEnded}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="w-full h-full object-contain bg-black"
                  playsInline
                />
              ) : (
                <>
                  <audio
                    key={currentMediaUrl}
                    ref={mediaRef as React.RefObject<HTMLAudioElement>}
                    src={currentMediaUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={handleMediaEnded}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                  {/* Album art or vinyl record fallback */}
                  {currentItem.albumArt ? (
                    <div className="relative flex items-center justify-center">
                      {/* Blurred background layer */}
                      <img
                        src={currentItem.albumArt}
                        alt=""
                        className="absolute w-56 h-56 object-cover blur-3xl opacity-30 scale-150"
                        aria-hidden
                      />
                      {/* Pulse ring — square to match album art */}
                      <div
                        className={`absolute w-36 h-36 rounded-xl border-2 border-[#7c3aed]/30 animate-pulse-ring ${
                          isPlaying ? "animate-pulse-ring-active" : "animate-pulse-ring-paused"
                        }`}
                      />
                      {/* Album art cover */}
                      <div className="w-28 h-28 rounded-xl overflow-hidden shadow-2xl ring-2 ring-white/10 relative">
                        <img
                          src={currentItem.albumArt}
                          alt={`${currentFileName} album art`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="relative flex items-center justify-center">
                      <div
                        className={`absolute w-36 h-36 rounded-full border-2 border-[#7c3aed]/30 animate-pulse-ring ${
                          isPlaying ? "animate-pulse-ring-active" : "animate-pulse-ring-paused"
                        }`}
                      />
                      <div
                        className="w-28 h-28 rounded-full bg-gradient-to-br from-[#1a1a2e] via-[#16161a] to-[#0f0f12] flex items-center justify-center shadow-2xl border border-white/5 animate-spin-slow vinyl-spinning"
                        style={{ animationPlayState: isPlaying ? "running" : "paused" }}
                      >
                        <div className="w-24 h-24 rounded-full border border-white/5 flex items-center justify-center">
                          <div className="w-20 h-20 rounded-full border border-white/[0.03] flex items-center justify-center">
                            <div className="w-16 h-16 rounded-full border border-white/[0.03] flex items-center justify-center">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#5b21b6] flex items-center justify-center shadow-lg">
                                <Music className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              {currentItem.isVideo && (
                <div className="absolute bottom-1.5 right-1.5 pointer-events-none">
                  <PictureInPicture2 className="w-3 h-3 text-white/20" />
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-white/20">
              {isDragOver ? (
                <>
                  <FolderOpen className="w-8 h-8 text-[#7c3aed]" />
                  <span className="text-xs text-[#7c3aed] font-medium">Drop to open</span>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
                    <Music className="w-6 h-6 text-white/45" />
                  </div>
                  <span className="text-[11px] text-white/45">
                    Drop media or right-click to open
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Seek Bar */}
        {hasMedia && (
          <div className="px-3 py-0 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/50 font-mono w-7 text-right">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 h-1"
              />
              <span className="text-[10px] text-white/50 font-mono w-7">
                {formatTime(duration)}
              </span>
            </div>
          </div>
        )}

        {/* Controls Bar */}
        <div className="px-3 pb-2 pt-0.5 shrink-0 flex items-center justify-center relative">
          <div className="flex items-center gap-0.5">
            {/* Previous track */}
            <button
              onClick={handlePrevTrack}
              disabled={!hasPrev}
              className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-15 disabled:hover:bg-transparent transition-colors text-white/55 hover:text-white/85"
              title="Previous track"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            {/* Rewind 10s */}
            <button
              onClick={handleSkipBack}
              disabled={!hasMedia}
              className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent transition-colors text-white/65 hover:text-white"
              title="Rewind 10s (←)"
            >
              <Rewind className="w-3.5 h-3.5" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={handlePlayPause}
              disabled={!hasMedia}
              className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent transition-colors text-white/65 hover:text-white"
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>

            {/* Forward 10s */}
            <button
              onClick={handleSkipForward}
              disabled={!hasMedia}
              className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent transition-colors text-white/65 hover:text-white"
              title="Forward 10s (→)"
            >
              <FastForward className="w-3.5 h-3.5" />
            </button>

            {/* Next track */}
            <button
              onClick={handleNextTrack}
              disabled={!hasNext}
              className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-15 disabled:hover:bg-transparent transition-colors text-white/55 hover:text-white/85"
              title="Next track"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Speed control - bottom right corner */}
          <div ref={speedMenuRef} className="absolute right-2 bottom-2 flex items-center">
            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 bg-[#141416] border border-white/10 rounded-lg shadow-2xl p-2 min-w-[140px] z-50">
                <div className="flex gap-1 mb-2">
                  {SPEED_PRESETS.map((speed) => (
                    <button
                      key={speed}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => handleSpeedChange(speed)}
                      className={`px-1.5 py-0.5 text-[10px] rounded font-mono transition-colors ${
                        playbackSpeed === speed
                          ? "bg-[#7c3aed] text-white"
                          : "bg-white/5 text-white/65 hover:bg-white/10"
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-white/45 font-mono">0.25x</span>
                  <input
                    type="range"
                    min={0.25}
                    max={3}
                    step={0.05}
                    value={playbackSpeed}
                    onChange={handleSpeedSlider}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="flex-1 h-1"
                  />
                  <span className="text-[9px] text-white/45 font-mono">3x</span>
                </div>
              </div>
            )}
            <button
              onClick={() => hasMedia && setShowSpeedMenu(!showSpeedMenu)}
              disabled={!hasMedia}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent transition-colors text-white/55 hover:text-white/75"
              title="Playback speed"
            >
              <Gauge className="w-3 h-3" />
              <span className="text-[10px] font-mono">
                {playbackSpeed === Math.round(playbackSpeed)
                  ? `${playbackSpeed}x`
                  : `${playbackSpeed.toFixed(2)}x`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
