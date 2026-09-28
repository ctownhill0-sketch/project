import { describe, expect, it } from "vitest";
import { scrollIntoList } from "@/components/split/scroll-into-list";

function rect(top: number, height: number) {
  return () => ({
    top,
    bottom: top + height,
    height,
    left: 0,
    right: 100,
    width: 100,
    x: 0,
    y: top,
    toJSON() {},
  });
}

function setup(rowTop: number) {
  const box = document.createElement("div");
  box.style.overflowY = "auto";
  const row = document.createElement("div");
  box.appendChild(row);
  document.body.appendChild(box);
  box.getBoundingClientRect = rect(100, 300);
  row.getBoundingClientRect = rect(rowTop, 40);
  box.scrollTop = 50;
  return { box, row };
}

describe("scrollIntoList", () => {
  it("scrolls the container down or up just enough, never the window", () => {
    const below = setup(420); // bottom 460 vs view bottom 400
    scrollIntoList(below.row);
    expect(below.box.scrollTop).toBe(110);
    const above = setup(80); // top 80 vs view top 100
    scrollIntoList(above.row);
    expect(above.box.scrollTop).toBe(30);
    const inside = setup(200);
    scrollIntoList(inside.row);
    expect(inside.box.scrollTop).toBe(50);
  });
});
