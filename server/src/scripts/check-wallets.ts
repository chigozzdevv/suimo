import { getDb, closeDb } from "@/config/db.js";
import { getBalances } from "@/services/sui/sui.service.js";

async function main() {
  const db = await getDb();
  const emailFilter = process.argv[2]?.toLowerCase();

  const users = await db
    .collection<{ _id: string; email: string }>("users")
    .find(
      emailFilter
        ? { email: { $regex: new RegExp(`^${emailFilter}$`, "i") } }
        : {},
    )
    .project({ _id: 1, email: 1 })
    .toArray();

  if (!users.length) {
    console.log(
      "No users found" + (emailFilter ? ` for email ${emailFilter}` : ""),
    );
    return;
  }

  for (const u of users) {
    console.log(`\nUser: ${u.email} (${u._id})`);
    const keys = await db
      .collection<{
        owner_user_id: string;
        role: "payer" | "payout";
        public_key: string;
      }>("wallet_keys")
      .find({ owner_user_id: u._id, chain: "sui" })
      .project({ owner_user_id: 1, role: 1, public_key: 1, _id: 0 })
      .toArray();

    if (!keys.length) {
      console.log("  No wallet keys");
      continue;
    }

    for (const k of keys) {
      try {
        const bal = await getBalances(k.public_key);
        console.log(
          `  ${k.role.padEnd(6)} | ${k.public_key} | SUI=${bal.sui.toFixed(6)} WAL=${bal.wal.toFixed(6)}`,
        );
      } catch (e: any) {
        console.log(
          `  ${k.role.padEnd(6)} | ${k.public_key} | ERROR: ${e?.message || e}`,
        );
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb().catch(() => {});
  });
