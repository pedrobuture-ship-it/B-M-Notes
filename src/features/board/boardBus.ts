export type BoardAction = "fit" | "zoomIn" | "zoomOut" | "newFrame" | "newNote";

/** Tiny event bus so commands outside the canvas (palette, shortcuts) can drive it. */
export function boardCommand(action: BoardAction) {
  window.dispatchEvent(new CustomEvent<BoardAction>("mural:board", { detail: action }));
}

export function onBoardCommand(handler: (a: BoardAction) => void): () => void {
  const fn = (e: Event) => handler((e as CustomEvent<BoardAction>).detail);
  window.addEventListener("mural:board", fn);
  return () => window.removeEventListener("mural:board", fn);
}
