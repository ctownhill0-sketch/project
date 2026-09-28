import { createCn } from "cn/config";

/**
 * Class merging that knows our type-scale utilities (text-display … text-caption)
 * are font sizes. Without this, text-small would be mistaken for a colour and
 * dropped when merged with text-muted-foreground.
 */
export const cn = createCn({
  extend: {
    classGroups: { "font-size": [{ text: ["display", "h1", "h2", "h3", "body", "small", "caption"] }] },
  },
});
