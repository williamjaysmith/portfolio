"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Square, ChevronRight, Volume2 } from "lucide-react";
import { audioTracks } from "@/lib/data";

const genres = ["Rock", "Rap/Pop", "Punk/Metal", "Acoustic"];

export default function MusicPlayer() {
  const [selectedGenre, setSelectedGenre] = useState<string>("Rock");
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentPlaylist = audioTracks[selectedGenre] || [];
  const currentTrack = currentPlaylist[currentTrackIndex];

  // Update audio source when track changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load();
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, [currentTrack]);

  // Auto-play next track if needed
  useEffect(() => {
    if (shouldAutoPlay && audioRef.current && duration > 0) {
      audioRef.current.play();
      setIsPlaying(true);
      setShouldAutoPlay(false);
    }
  }, [shouldAutoPlay, duration]);

  // Handle play
  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // Handle pause
  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Handle stop
  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  // Handle next track
  const handleNext = () => {
    if (isPlaying) {
      setShouldAutoPlay(true);
    }

    // Check if we're on the last track of current genre
    if (currentTrackIndex === currentPlaylist.length - 1) {
      // Move to next genre
      const currentGenreIndex = genres.indexOf(selectedGenre);
      const nextGenreIndex = (currentGenreIndex + 1) % genres.length;
      setSelectedGenre(genres[nextGenreIndex]);
      setCurrentTrackIndex(0);
    } else {
      // Normal track progression within genre
      setCurrentTrackIndex((prev) => prev + 1);
    }
  };

  // Handle time update
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  // Handle loaded metadata
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  // Handle seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  };

  // Handle genre change
  const handleGenreChange = (genre: string) => {
    setSelectedGenre(genre);
    setCurrentTrackIndex(0);
    setIsPlaying(false);
  };

  // Handle track end
  const handleEnded = () => {
    setShouldAutoPlay(true);

    // Check if we're on the last track of current genre
    if (currentTrackIndex === currentPlaylist.length - 1) {
      // Move to next genre
      const currentGenreIndex = genres.indexOf(selectedGenre);
      const nextGenreIndex = (currentGenreIndex + 1) % genres.length;
      setSelectedGenre(genres[nextGenreIndex]);
      setCurrentTrackIndex(0);
    } else {
      // Normal track progression within genre
      setCurrentTrackIndex((prev) => prev + 1);
    }
  };

  return (
    <div className="w-full">
      {/* Player Card */}
      <div className="border-3 border-[#2c2c2c] bg-white rounded-2xl overflow-hidden">
        {/* Genre Selector - Black Bar at Top */}
        <div className="bg-[#2c2c2c] px-1 md:px-4 py-2 flex items-center justify-center" style={{ borderTopLeftRadius: '13px', borderTopRightRadius: '13px' }}>
          {/* Genre Buttons - All Screens */}
          <div className="flex gap-0.5 sm:gap-1 md:gap-2 justify-between md:justify-center w-full">
            {genres.map((genre) => (
              <motion.button
                key={genre}
                onClick={() => handleGenreChange(genre)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-1.5 sm:px-2 md:px-4 py-1 rounded-lg font-bold text-xs md:text-sm transition-colors ${
                  selectedGenre === genre
                    ? "bg-white text-[#2c2c2c]"
                    : "text-white hover:bg-white/10"
                }`}
              >
                {genre}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Track Info */}
        <div className="p-6 md:p-8">
          <div className="mb-6">
            <div className="text-sm md:text-base text-[#2c2c2c] space-y-1">
              <p><span className="font-bold">Artist:</span> <span className="font-bold">{currentTrack.artist}</span></p>
              <p><span className="font-bold">Genre:</span> {currentTrack.genre}</p>
              <p><span className="font-bold">Role:</span> {currentTrack.provenance.join(", ")}</p>
            </div>
          </div>

          {/* Controls - Simplified Black Bar */}
          <div className="bg-[#2c2c2c] -mx-6 md:-mx-8 -mb-6 md:-mb-8 px-4 py-4 flex items-center gap-3 md:gap-4" style={{ borderBottomLeftRadius: '13px', borderBottomRightRadius: '13px' }}>
          {/* Play/Pause Button */}
          <motion.button
            onClick={isPlaying ? handlePause : handlePlay}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="text-white flex items-center justify-center flex-shrink-0"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 md:w-7 md:h-7" strokeWidth={3} fill="white" />
            ) : (
              <Play className="w-6 h-6 md:w-7 md:h-7" strokeWidth={3} fill="white" />
            )}
          </motion.button>

          {/* Stop Button */}
          <motion.button
            onClick={handleStop}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="text-white flex items-center justify-center flex-shrink-0"
          >
            <Square className="w-5 h-5 md:w-6 md:h-6" strokeWidth={3} fill="white" />
          </motion.button>

          {/* Next Button */}
          <motion.button
            onClick={handleNext}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="text-white flex items-center justify-center flex-shrink-0"
          >
            <div className="flex items-center -space-x-2">
              <ChevronRight className="w-6 h-6 md:w-7 md:h-7" strokeWidth={3} />
              <ChevronRight className="w-6 h-6 md:w-7 md:h-7" strokeWidth={3} />
            </div>
          </motion.button>

          {/* Progress Bar - Hidden below sm */}
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="hidden sm:flex flex-1 h-1 rounded-lg appearance-none cursor-pointer slider-white mx-4"
            style={{
              background: `linear-gradient(to right, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.3) ${
                duration ? (currentTime / duration) * 100 : 0
              }%, white ${duration ? (currentTime / duration) * 100 : 0}%, white 100%)`,
            }}
          />

          {/* Spacer for mobile - pushes volume to right when progress bar hidden */}
          <div className="flex-1 sm:hidden"></div>

          {/* Volume Icon */}
          <Volume2 className="w-5 h-5 md:w-6 md:h-6 text-white flex-shrink-0" strokeWidth={3} />

          {/* Volume Control */}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="w-20 md:w-24 h-1 rounded-lg appearance-none cursor-pointer slider-white flex-shrink-0"
            style={{
              background: `linear-gradient(to right, white 0%, white ${
                volume * 100
              }%, rgba(255,255,255,0.3) ${volume * 100}%, rgba(255,255,255,0.3) 100%)`,
            }}
          />
        </div>
        </div>

        {/* Hidden Audio Element */}
        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        >
          <source src={currentTrack.audioSrc} type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
      </div>
    </div>
  );
}
