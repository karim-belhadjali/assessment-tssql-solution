import { db, schema } from "../../db/client";
import { trpcError } from "../../trpc/core";
import { eq } from "drizzle-orm";

interface PlanAttributes {
  name: string;
  price: number;
}

interface UpdatePlanAttributes extends PlanAttributes {
  id: number;
}

export const createPlan = async (attributes: PlanAttributes) => {
  const [plan] = await db
    .insert(schema.plans)
    .values({
      ...attributes,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  if (!plan) {
    throw new trpcError({
      code: "BAD_REQUEST",
      message: "Plan not created",
    });
  }
  return plan;
};

export const updatePlan = async (attributes: UpdatePlanAttributes) => {
  const [plan] = await db
    .update(schema.plans)
    .set({
      name: attributes.name,
      price: attributes.price,
      updatedAt: new Date(),
    })
    .where(eq(schema.plans.id, attributes.id))
    .returning();
  if (!plan) {
    throw new trpcError({
      code: "NOT_FOUND",
      message: "Plan not found",
    });
  }
  return plan;
};

export const getPlan = async (id: number) => {
  const plan = await db
    .select()
    .from(schema.plans)
    .where(eq(schema.plans.id, id))
    .get();
  if (!plan) {
    throw new trpcError({
      code: "NOT_FOUND",
      message: "Plan not found",
    });
  }
  return plan;
};

interface ProratedUpgradeInput {
  currentPlanId: number;
  newPlanId: number;
  daysRemainingInCycle: number;
}

export const calculateProratedUpgradePrice = async ({
  currentPlanId,
  newPlanId,
  daysRemainingInCycle,
}: ProratedUpgradeInput) => {
  const currentPlan = await getPlan(currentPlanId);
  const newPlan = await getPlan(newPlanId);

  if (!currentPlan || !newPlan) {
    throw new trpcError({
      code: "NOT_FOUND",
      message: "Plan not found",
    });
  }

  const dailyRateDifference = (newPlan.price - currentPlan.price) / 30;
  const proratedAmount = dailyRateDifference * daysRemainingInCycle;

  return Math.max(proratedAmount, 0);
};
