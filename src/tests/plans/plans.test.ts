import { beforeAll, describe, expect, it, beforeEach } from "vitest";
import { db, schema } from "../../db/client";
import { createAuthenticatedCaller, createCaller } from "../helpers/utils";
import resetDb from "../helpers/resetDb";
import { eq } from "drizzle-orm";
import { trpcError } from "../../trpc/core";

const adminUser = {
  email: "admin@mail.com",
  password: "P@ssw0rd",
  name: "Admin User",
  timezone: "UTC",
  locale: "en",
};

const normalUser = {
  email: "user@mail.com",
  password: "P@ssw0rd",
  name: "Normal User",
  timezone: "UTC",
  locale: "en",
};

const basePlan = {
  name: "Basic Plan",
  price: 1000,
};

const updatePlan = {
  name: "Updated Plan",
  price: 1200,
};

describe("plans routes", () => {
  beforeAll(async () => {
    await resetDb();
  });

  let adminCaller: ReturnType<typeof createAuthenticatedCaller>;
  let userCaller: ReturnType<typeof createAuthenticatedCaller>;
  let createdPlanId: number;

  beforeEach(async () => {
    await resetDb();

    // Register and verify admin user
    await createCaller({}).auth.register(adminUser);
    const adminInDb = await db.query.users.findFirst({
      where: eq(schema.users.email, adminUser.email),
    });
    await db
      .update(schema.users)
      .set({ isAdmin: true })
      .where(eq(schema.users.id, adminInDb!.id));
    adminCaller = createAuthenticatedCaller({ userId: adminInDb!.id });

    // Register and verify normal user
    await createCaller({}).auth.register(normalUser);
    const userInDb = await db.query.users.findFirst({
      where: eq(schema.users.email, normalUser.email),
    });
    userCaller = createAuthenticatedCaller({ userId: userInDb!.id });
  });

  it("should create a new plan as admin", async () => {
    const result = await adminCaller.plans.create(basePlan);
    expect(result.name).toBe(basePlan.name);
    expect(result.price).toBe(basePlan.price);

    createdPlanId = result.id;
  });

  it("should fail to create a new plan as non-admin", async () => {
    await expect(userCaller.plans.create(basePlan)).rejects.toThrow(
      new trpcError({
        code: "UNAUTHORIZED",
        message: "Only admins can perform this action",
      })
    );
  });

  it("should update an existing plan as admin", async () => {
    const createdPlan = await adminCaller.plans.create(basePlan);
    createdPlanId = createdPlan.id;

    const result = await adminCaller.plans.update({
      ...updatePlan,
      id: createdPlanId,
    });
    expect(result.name).toBe(updatePlan.name);
    expect(result.price).toBe(updatePlan.price);
  });

  it("should fail to update an existing plan as non-admin", async () => {
    const createdPlan = await adminCaller.plans.create(basePlan);
    createdPlanId = createdPlan.id;

    await expect(
      userCaller.plans.update({
        ...updatePlan,
        id: createdPlanId,
      })
    ).rejects.toThrow(
      new trpcError({
        code: "UNAUTHORIZED",
        message: "Only admins can perform this action",
      })
    );
  });

  it("should get a plan by ID", async () => {
    const createdPlan = await adminCaller.plans.create(basePlan);
    createdPlanId = createdPlan.id;

    const result = await userCaller.plans.getOne({ id: createdPlanId });
    expect(result.name).toBe(basePlan.name);
    expect(result.price).toBe(basePlan.price);
  });

  it("should calculate prorated upgrade price", async () => {
    const basicPlan = await adminCaller.plans.create(basePlan);
    const premiumPlan = await adminCaller.plans.create({
      name: "Premium Plan",
      price: 2000,
    });

    // Calculate expected prorated price
    const daysInMonth = 30;
    const daysRemaining = 15;
    const priceDifference = premiumPlan.price - basicPlan.price;
    const expectedProratedPrice =
      (priceDifference / daysInMonth) * daysRemaining;

    const proratedPrice = await adminCaller.plans.calculateUpgradePrice({
      currentPlanId: basicPlan.id,
      newPlanId: premiumPlan.id,
      daysRemainingInCycle: daysRemaining,
    });

    expect(proratedPrice).toBe(expectedProratedPrice);
  });
});
