"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Volume2, SkipForward, SkipBack, GripVertical } from "lucide-react";
import Image from "next/image";
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

interface Track {
  id: string;
  title: string;
  audioSrc: string;
}

function SortableTrackItem({
  track,
  index,
  isCurrentTrack,
  isPlaying,
  onTrackClick,
}: {
  track: Track;
  index: number;
  isCurrentTrack: boolean;
  isPlaying: boolean;
  onTrackClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 flex items-center gap-4 border-b border-[#2c2c2c]/20 ${
        isCurrentTrack ? "bg-[#2c2c2c]/10" : ""
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-[#2c2c2c]/50 hover:text-[#2c2c2c]"
      >
        <GripVertical className="w-5 h-5" />
      </div>
      <motion.div
        onClick={onTrackClick}
        whileHover={{ backgroundColor: "rgba(44, 44, 44, 0.05)" }}
        className="flex-1 flex items-center gap-4 cursor-pointer rounded px-2 py-1"
      >
        <span
          className={`text-[#2c2c2c] flex-1 ${
            isCurrentTrack ? "font-extrabold" : "font-semibold"
          }`}
        >
          {track.title}
        </span>
        {isCurrentTrack && isPlaying && (
          <div className="flex gap-0.5">
            <motion.div
              animate={{ height: ["4px", "16px", "4px"] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="w-1 bg-[#2c2c2c]"
            />
            <motion.div
              animate={{ height: ["8px", "12px", "8px"] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="w-1 bg-[#2c2c2c]"
            />
            <motion.div
              animate={{ height: ["12px", "4px", "12px"] }}
              transition={{ duration: 0.7, repeat: Infinity }}
              className="w-1 bg-[#2c2c2c]"
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function Skyhammer() {
  // Album tracks
  const initialTracks: Track[] = [
    { id: "1", title: "Bad Blood", audioSrc: "/audio/skyhammer/Bad Blood R05.mp3" },
    { id: "2", title: "Fire It Up", audioSrc: "/audio/skyhammer/Fire It Up R05 (1).mp3" },
    { id: "3", title: "Give 'Em Hell", audioSrc: "/audio/skyhammer/Give 'Em Hell R05.mp3" },
    { id: "4", title: "Hell Yeah", audioSrc: "/audio/skyhammer/Hell Yeah R05.mp3" },
    { id: "5", title: "Runnin' Wild", audioSrc: "/audio/skyhammer/Runnin' Wild R05.mp3" },
  ];

  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [mounted, setMounted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLInputElement>(null);
  const volumeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle track changes - reload audio when track index changes
  useEffect(() => {
    if (audioRef.current && mounted) {
      audioRef.current.load();
      setCurrentTime(0);
    }
  }, [currentTrackIndex, mounted]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const currentTrack = tracks[currentTrackIndex];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setTracks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        // Update current track index if the currently playing track was moved
        const currentTrackId = items[currentTrackIndex].id;
        const newItems = arrayMove(items, oldIndex, newIndex);
        const newCurrentIndex = newItems.findIndex(
          (item) => item.id === currentTrackId
        );
        setCurrentTrackIndex(newCurrentIndex);

        return newItems;
      });
    }
  };

  const handleTrackClick = (index: number) => {
    setCurrentTrackIndex(index);
    setCurrentTime(0);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }, 100);
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handlePrevious = () => {
    const newIndex = currentTrackIndex > 0 ? currentTrackIndex - 1 : tracks.length - 1;
    setCurrentTrackIndex(newIndex);
    // Audio will load via useEffect, then we play it
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.error('Play error:', e));
        setIsPlaying(true);
      }
    }, 200);
  };

  const handleNext = () => {
    const newIndex = currentTrackIndex < tracks.length - 1 ? currentTrackIndex + 1 : 0;
    setCurrentTrackIndex(newIndex);
    // Audio will load via useEffect, then we play it
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.error('Play error:', e));
        setIsPlaying(true);
      }
    }, 200);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Calculate gradient position accounting for thumb width and slider dimensions
  const getGradientPosition = (value: number, max: number, sliderRef: React.RefObject<HTMLInputElement | null>) => {
    if (!max || !sliderRef.current) {
      return (value / (max || 1)) * 100;
    }

    const thumbWidth = 40;
    const sliderWidth = sliderRef.current.offsetWidth;
    const percentage = value / max;

    // The thumb center travels from (thumbWidth/2) to (sliderWidth - thumbWidth/2)
    // Calculate where the thumb center actually is as a percentage of the total slider width
    const thumbCenterPixels = (thumbWidth / 2) + percentage * (sliderWidth - thumbWidth);
    const gradientPercent = (thumbCenterPixels / sliderWidth) * 100;

    return gradientPercent;
  };

  return (
    <>
      <style jsx>{`
        input[type="range"].slider-pink {
          -webkit-appearance: none;
          appearance: none;
        }

        input[type="range"].slider-pink::-webkit-slider-track {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          border: none;
        }

        input[type="range"].slider-pink::-moz-range-track {
          background: transparent;
          border: none;
        }

        input[type="range"].slider-pink::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 40px;
          height: 40px;
          background-color: transparent;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24'%3E%3Cpath d='M13 2L3 14h8l-1 8 10-12h-8l1-8z' fill='%23f3e1b7' stroke='%232c2c2c' stroke-width='0.9' stroke-linejoin='round' transform='rotate(15 12 12)'/%3E%3C/svg%3E");
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          cursor: pointer;
          margin-top: 0px;
          border: none;
          box-shadow: none;
          -webkit-box-shadow: none;
        }

        input[type="range"].slider-pink::-moz-range-thumb {
          width: 40px;
          height: 40px;
          border: none;
          border-radius: 0;
          background-color: transparent;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24'%3E%3Cpath d='M13 2L3 14h8l-1 8 10-12h-8l1-8z' fill='%23f3e1b7' stroke='%232c2c2c' stroke-width='0.9' stroke-linejoin='round' transform='rotate(15 12 12)'/%3E%3C/svg%3E");
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          cursor: pointer;
          box-shadow: none;
        }

        input[type="range"].slider-volume::-webkit-slider-thumb {
          width: 30px;
          height: 30px;
          background-color: transparent;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 24 24'%3E%3Cpath d='M13 2L3 14h8l-1 8 10-12h-8l1-8z' fill='%23f3e1b7' stroke='%232c2c2c' stroke-width='0.9' stroke-linejoin='round' transform='rotate(15 12 12)'/%3E%3C/svg%3E");
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          border: none;
          box-shadow: none;
          -webkit-box-shadow: none;
        }

        input[type="range"].slider-volume::-moz-range-thumb {
          width: 30px;
          height: 30px;
          background-color: transparent;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 24 24'%3E%3Cpath d='M13 2L3 14h8l-1 8 10-12h-8l1-8z' fill='%23f3e1b7' stroke='%232c2c2c' stroke-width='0.9' stroke-linejoin='round' transform='rotate(15 12 12)'/%3E%3C/svg%3E");
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          border: none;
          box-shadow: none;
        }
      `}</style>
      <div
        className="min-h-screen flex items-center justify-center px-5"
        style={{
          backgroundColor: "#fbf8f0",
          backgroundImage: "url('/Images/Skyhammer/skyhammerplayerbackground.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="w-full max-w-md pb-16">
        {/* Logo Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex justify-center mb-4"
        >
          <Image
            src="/Images/Skyhammer/skyhammerlogo.png"
            alt="Skyhammer"
            width={448}
            height={200}
            className="w-full"
            priority
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="border border-[#2c2c2c] p-8 shadow-lg"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.5)" }}
        >
          {/* Tracklist */}
          {mounted ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={tracks}
                strategy={verticalListSortingStrategy}
              >
                <div className="mb-8">
                  {tracks.map((track, index) => (
                    <SortableTrackItem
                      key={track.id}
                      track={track}
                      index={index}
                      isCurrentTrack={currentTrackIndex === index}
                      isPlaying={isPlaying}
                      onTrackClick={() => handleTrackClick(index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="mb-8">
              {tracks.map((track, index) => (
                <div
                  key={track.id}
                  className={`p-4 flex items-center gap-4 border-b border-[#2c2c2c]/20 ${
                    currentTrackIndex === index ? "bg-[#2c2c2c]/10" : ""
                  }`}
                >
                  <div className="cursor-grab active:cursor-grabbing text-[#2c2c2c]/50 hover:text-[#2c2c2c]">
                    <GripVertical className="w-5 h-5" />
                  </div>
                  <div
                    onClick={() => handleTrackClick(index)}
                    className="flex-1 flex items-center gap-4 cursor-pointer rounded px-2 py-1"
                  >
                    <span
                      className={`text-[#2c2c2c] flex-1 ${
                        currentTrackIndex === index ? "font-extrabold" : "font-semibold"
                      }`}
                    >
                      {track.title}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Progress Bar */}
          <div className="mb-6">
            <input
              ref={progressRef}
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer slider-pink"
              style={{
                background: `linear-gradient(to right, #4a4a4a 0%, #4a4a4a ${
                  getGradientPosition(currentTime, duration, progressRef)
                }%, #e5e5e5 ${getGradientPosition(currentTime, duration, progressRef)}%, #e5e5e5 100%)`,
              }}
            />
            <div className="flex justify-between text-sm text-[#2c2c2c] mt-2">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-10">
            {/* Previous/Play/Next - Centered */}
            <div className="flex items-center justify-center gap-4">
              <motion.button
                onClick={handlePrevious}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="text-[#4a4a4a]"
              >
                <SkipBack className="w-7 h-7" strokeWidth={2} fill="#4a4a4a" />
              </motion.button>

              <motion.button
                onClick={handlePlayPause}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-14 h-14 rounded-full border-2 border-[#4a4a4a] bg-[#4a4a4a] text-white flex items-center justify-center transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7" strokeWidth={2} />
                ) : (
                  <Play className="w-7 h-7" strokeWidth={2} />
                )}
              </motion.button>

              <motion.button
                onClick={handleNext}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="text-[#4a4a4a]"
              >
                <SkipForward className="w-7 h-7" strokeWidth={2} fill="#4a4a4a" />
              </motion.button>
            </div>

            {/* Volume Control - Right Aligned - Hidden on Mobile */}
            <div className="hidden sm:flex items-center justify-end gap-3">
              <Volume2 className="w-5 h-5 text-[#2c2c2c]" strokeWidth={2.5} />
              <input
                ref={volumeRef}
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="w-24 h-1 rounded-lg appearance-none cursor-pointer slider-pink slider-volume"
                style={{
                  background: `linear-gradient(to right, #4a4a4a 0%, #4a4a4a ${
                    getGradientPosition(volume, 1, volumeRef)
                  }%, #e5e5e5 ${getGradientPosition(volume, 1, volumeRef)}%, #e5e5e5 100%)`,
                }}
              />
            </div>
          </div>

          {/* Hidden Audio Element */}
          <audio
            ref={audioRef}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleNext}
          >
            <source src={currentTrack.audioSrc} type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
        </motion.div>
      </div>
    </div>
    </>
  );
}
