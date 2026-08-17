import mongoose from "mongoose";
import dotenv from "dotenv";
import User, { UserRole } from "../model/user.model.js";
import CreditAccount from "../model/creditAccount.model.js";
import CreditTransaction, { TransactionType } from "../model/creditTransaction.model.js";

dotenv.config();

export const runMigration = async () => {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error("MONGO_URL is required in environment");
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUrl);
  }

  // 1. Backfill missing roles to 'user'
  const roleResult = await User.updateMany(
    { role: { $exists: false } },
    { $set: { role: UserRole.USER } }
  );

  // 2. Ensure every existing user has a CreditAccount with 100 free credits
  const users = await User.find();
  let accountsCreated = 0;

  for (const user of users) {
    const userId = user._id.toString();
    const existingAcc = await CreditAccount.findOne({ userId });

    if (!existingAcc) {
      await CreditAccount.create({
        userId,
        balance: 100,
        totalGranted: 100,
        totalPurchased: 0,
        totalConsumed: 0,
        reserved: 0,
      });

      try {
        await CreditTransaction.create({
          userId,
          type: TransactionType.FREE_GRANT,
          amount: 100,
          balanceBefore: 0,
          balanceAfter: 100,
          source: "WELCOME_BONUS_MIGRATION",
          referenceId: `welcome_${userId}`,
          description: "Initial 100 Free AI Credits (Migration)",
        });
      } catch (err: any) {
        if (err.code !== 11000) throw err;
      }

      accountsCreated++;
    }
  }

  return { roleResult: roleResult.modifiedCount, accountsCreated };
};

if (process.argv[1] && process.argv[1].endsWith("migrate_users.ts")) {
  runMigration()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
