# Assessment in Typescript & SQL

## Getting started

This repo runs using fastify, trpc, zod, drizzle, and sqlite.

It uses node 20 & pnpm.

To get started, run the following commands:

```
pnpm install
```

Initiate the Sqlite DB:

```
pnpm db:push
```

Then, you can run typechecking, linting, or testing via the following commands:

```
pnpm typecheck

pnpm lint

pnpm test:int
```

## Intro to the SaaS API design

This system has a few core modules that support a B2B SaaS setup.

The current API supports the following models:

- auth: login, register, email verify, password reset
- account: for user to manage his own account
- teams: for users to create teams

The next features to be added are related to billing, the subscriptions module would include four main tables:

- plans: this is the base definition for a plan, it includes plan name & price
- subscriptions: this is the list of active subscriptions
- subscriptionActivations: this is the table where we track billing cycles for each paid "month" or "year"
- orders: an order when paid creates an "Activation" record

the lifecycle of a subscription is:

- user creates a team subscription, with a reference to a specific team they own and a plan choice from the system
- subscriptions, aslong as they are active, will always issue orders via background cron jobs (if an activation record doesn't exist for the current period)
- orders, when paid, create subscriptionActivations

more tables may exist in a more complete "realistic" scenario, but this is a simplified version of a subscriptions system.

## Problem Statement (required)

Define the plans module & write atleast 5 tests that verify the core functionality works in the plans module.

The module should support a number of method:

1. create & update methods, not publicly accessible, admin access only
2. read method, accessible publicly
3. a prorated upgrade price calculation method: the system should allow upgrading to a more expensive plan in the middle of a subscription, so, we need to create a method that can determine the price for an "upgrade", based on price difference between two plans and the number of days remaining in the currently paid cycle, you can assume all plans are monthly cycles only, no annual plans are to be considered here

The best way to test the endpoints/methods you are building is by running the integration tests and creating testing scenarios for the new plans module, in the integration testing directory, by following the conventions done by other tests.

Trpc won't work well with playground testing tools like postman.

## schema design implementation (bonus)

without defining all the other modules in the billing module, just define the shape of the tables to be defined for the following:

- subscriptions
- orders
- subscriptionActivations

And create some scaffolding for the tests, the tests would be failing initially, by simply defining the purpose of some of the core integration tests for these modules

## question (bonus)

If you were to introduce two more props to plans:

1. defaultUsers: number of users included in the plan by default
2. pricePerUser: price per additional user beyond the default

How would this affect the current plan upgrade calculation?

### answer here:

As I understood, by adding these attirbutes, we will have a subscription service where userscan buy plans and each plan includesa certain number of users by defaults,
and if we want to add more user, the userhave to pay extra for each additional user.

Let's say we have two plans:

    Basic Plan:
        Cost: $100 per month
        Includes 5 users
        If we want more than 5 users, we pay $10 for each extra user

    Premium Plan:
        Cost: $200 per month
        Includes 10 users
        If we want more than 10 users, we pay $8 for each extra user

we need to modify the logic to take the current number of user for us to be able to calculate the upgrade cost.

we need to calculate the total cost of the current plan whihc is the basic plan in our case, then the total cost for the new plan (the premium plan), then based on those
values we calculate the difference and assuming the month have 30days then we divide the result by 30 to have the daily cost of the upgrade.

Finally we multiply that value with the remaining days of the month that we pass as a parameter to the function.

Here's what the function should look like:

```
interface Plan {
  id: number;
  name: string;
  price: number;
  defaultUsers: number;
  pricePerUser: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ProratedUpgradeInput {
  currentPlanId: number;
  newPlanId: number;
  daysRemainingInCycle: number;
  currentSubscriptionUsers: number;
}

const calculateProratedUpgradePrice = async ({
  currentPlanId,
  newPlanId,
  daysRemainingInCycle,
  currentSubscriptionUsers,
}: ProratedUpgradeInput) => {
  const currentPlan = await getPlan(currentPlanId);
  const newPlan = await getPlan(newPlanId);

  if (!currentPlan || !newPlan) {
    throw new Error("Plan not found");
  }

  const totalCurrentCost =
    currentPlan.price +
    Math.max(0, currentSubscriptionUsers - currentPlan.defaultUsers) *
      currentPlan.pricePerUser;

  const totalNewCost =
    newPlan.price +
    Math.max(0, currentSubscriptionUsers - newPlan.defaultUsers) *
      newPlan.pricePerUser;

  const dailyRateDifference = (totalNewCost - totalCurrentCost) / 30;
  const proratedAmount = dailyRateDifference * daysRemainingInCycle;

  return Math.max(proratedAmount, 0);
};

```
