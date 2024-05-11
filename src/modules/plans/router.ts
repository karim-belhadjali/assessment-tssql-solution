import { router, trpcError, protectedProcedure } from "../../trpc/core";
import { z } from "zod";
import {
  createPlan,
  updatePlan,
  getPlan,
  calculateProratedUpgradePrice,
} from "./model";
import { db, schema } from "../../db/client";
import { eq } from "drizzle-orm";

const PlanInputSchema = z.object({
  name: z.string(),
  price: z.number(),
});

const UpdatePlanSchema = PlanInputSchema.extend({ id: z.number() });

const checkAdmin = async (userId: number) => {
  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();

  if (!user) {
    throw new trpcError({
      code: "UNAUTHORIZED",
      message: "User not found",
    });
  }

  if (!user.isAdmin) {
    throw new trpcError({
      code: "UNAUTHORIZED",
      message: "Only admins can perform this action",
    });
  }
};

export const plans = router({
  create: protectedProcedure
    .input(PlanInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await checkAdmin(user.userId);
      return createPlan(input);
    }),

  update: protectedProcedure
    .input(UpdatePlanSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await checkAdmin(user.userId);
      return updatePlan(input);
    }),

  getOne: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getPlan(input.id);
    }),

  calculateUpgradePrice: protectedProcedure
    .input(
      z.object({
        currentPlanId: z.number(),
        newPlanId: z.number(),
        daysRemainingInCycle: z.number(),
      })
    )
    .query(async ({ input }) => {
      return calculateProratedUpgradePrice(input);
    }),
});
