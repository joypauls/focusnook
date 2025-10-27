import { useEffect, useRef } from "react";

export interface SoundSettings {
  soundFile: string;
  volume: number;
}

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SoundSettings;
  onSettingsChange: (settings: SoundSettings) => void;
}

const SOUND_OPTIONS = [
  { value: "/beep1.mp3", label: "Gentle Beep" },
  { value: "/beep2.mp3", label: "Alert Beep" },
  { value: "none", label: "No Sound" }
];



export function SettingsMenu({ isOpen, onClose, settings, onSettingsChange }: SettingsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const playPreview = (soundFile: string) => {
    if (soundFile === "none") return;
    
    const audio = new Audio(soundFile);
    audio.volume = settings.volume;
    audio.play().catch(() => {});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-20">
      <div 
        ref={menuRef}
        className="w-80 rounded-2xl p-6 border border-white/10 bg-white/10 backdrop-blur-lg shadow-2xl animate-in slide-in-from-top-2 duration-200"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition text-white/60 hover:text-white/90"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* Sound Selection */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-3">
              Completion Sound
            </label>
            <div className="space-y-2">
              {SOUND_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center justify-between">
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="radio"
                      name="sound"
                      value={option.value}
                      checked={settings.soundFile === option.value}
                      onChange={(e) => 
                        onSettingsChange({ ...settings, soundFile: e.target.value })
                      }
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center transition ${
                      settings.soundFile === option.value
                        ? 'border-cyan-400 bg-cyan-500/20'
                        : 'border-white/30 group-hover:border-white/50'
                    }`}>
                      {settings.soundFile === option.value && (
                        <div className="w-2 h-2 rounded-full bg-cyan-400" />
                      )}
                    </div>
                    <span className="text-sm text-white/80 group-hover:text-white/90">
                      {option.label}
                    </span>
                  </label>
                  {option.value !== "none" && (
                    <button
                      onClick={() => playPreview(option.value)}
                      className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white/90 transition"
                      title="Preview sound"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="5,3 19,12 5,21"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>



          {/* Volume Control */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-3">
              Volume
            </label>
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/60">
                <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
              </svg>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.volume}
                onChange={(e) => onSettingsChange({ ...settings, volume: parseFloat(e.target.value) })}
                className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
              />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/60">
                <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/>
              </svg>
            </div>
            <div className="text-xs text-white/50 text-center mt-1">
              {Math.round(settings.volume * 100)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
