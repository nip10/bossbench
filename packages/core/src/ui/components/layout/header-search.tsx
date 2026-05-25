import { Search } from "lucide-react";
import { Input } from "../ui/input";

export function HeaderSearch({
  value,
  onValueChange,
  onFocus,
  placeholder = "Search…",
}: {
  value: string;
  onValueChange: (value: string) => void;
  onFocus?: () => void;
  placeholder?: string;
}) {
  return (
    <div className="search">
      <Search size={14} />
      <Input
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
      />
    </div>
  );
}
