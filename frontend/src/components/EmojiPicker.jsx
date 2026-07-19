import { QUICK_EMOJI } from "../constants.js";

export default function EmojiPicker({ onSelect }) {
  return (
    <div className="emoji-picker">
      {QUICK_EMOJI.map((e) => (
        <button key={e} type="button" onClick={() => onSelect(e)}>
          {e}
        </button>
      ))}
    </div>
  );
}
