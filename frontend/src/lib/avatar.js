// Purely decorative per-post color variety — never tied to a persistent
// identity. Same report always renders the same color (hashed from its own
// id), but there is no way to tell two different reports came from the same
// anonymous person, which is the whole point of this platform.
//
// Deliberately excludes red/red-adjacent tones — red is reserved for the
// single-purpose notification badge and must not appear anywhere else.
const PALETTE = ["#FF9500", "#FFCC00", "#34C759", "#30D6C4", "#0A84FF", "#5E5CE6", "#BF5AF2", "#64D2FF", "#A2845E"];

export function avatarColor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
