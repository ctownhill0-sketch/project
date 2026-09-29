"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { toResult } from "@/lib/actions/result";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { logShop, recordReply } from "@/lib/shops/service";

const When = z.coerce.date();

export async function logShopAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = z
      .object({
        companyId: z.uuid(),
        channel: z.enum(["email", "phone", "listing_site", "website_form"]),
        sentAt: When,
        listingRef: z.string().max(300).nullish(),
        notes: z.string().max(2000).nullish(),
      })
      .parse(raw);
    const shop = await logShop(await getDb(), user, input, new Date());
    refresh();
    return { shopId: shop.id, hoursBucket: shop.hoursBucket };
  });
}

export async function replyAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = z
      .object({
        shopId: z.uuid(),
        repliedAt: When.optional(),
        replyType: z.enum(["human", "auto", "ai"]),
        tourOffered: z.boolean().optional(),
      })
      .parse(raw);
    const now = new Date();
    await recordReply(
      await getDb(),
      user,
      input.shopId,
      { repliedAt: input.repliedAt ?? now, replyType: input.replyType, tourOffered: input.tourOffered },
      now,
    );
    refresh();
    return null;
  });
}
