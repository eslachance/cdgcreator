import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
}

const PRESET_COLORS = [
  '#FFFFFF', '#FFFF00', '#00FFFF', '#FF00FF',
  '#FF0000', '#00FF00', '#0000FF', '#FFA500',
  '#FFD700', '#FF69B4', '#00CED1', '#9400D3',
  '#32CD32', '#FF4500', '#1E90FF', '#FF1493',
];

export function ColorPicker({ color, onChange, label }: ColorPickerProps) {
  const [localColor, setLocalColor] = useState(color);

  const handleColorChange = (newColor: string) => {
    setLocalColor(newColor);
    onChange(newColor);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 h-9"
        >
          <div
            className="w-4 h-4 rounded-sm border border-border"
            style={{ backgroundColor: color }}
          />
          <span className="flex-1 text-left text-xs truncate">
            {label || color}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="space-y-3">
          <div className="grid grid-cols-8 gap-1.5">
            {PRESET_COLORS.map((presetColor) => (
              <button
                key={presetColor}
                className="w-6 h-6 rounded-md border border-border transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring"
                style={{ backgroundColor: presetColor }}
                onClick={() => handleColorChange(presetColor)}
              />
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <Input
              type="color"
              value={localColor}
              onChange={(e) => handleColorChange(e.target.value)}
              className="w-10 h-8 p-0 border-0 cursor-pointer"
            />
            <Input
              type="text"
              value={localColor}
              onChange={(e) => handleColorChange(e.target.value)}
              className="flex-1 h-8 font-mono text-xs"
              placeholder="#FFFFFF"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

