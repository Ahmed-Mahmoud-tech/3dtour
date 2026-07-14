// One-time migration (2026-07): subscriptions used to be one-per-OWNER;
// they are now one-per-PROJECT. For every legacy subscription (doc with an
// `owner` field), copy it onto each project assigned to that owner, then
// remove the legacy doc. Finally sync indexes (drops the old unique `owner`
// index, creates the unique `project` index).
//
// Run from server/:  node scripts/migrate-subscriptions-per-project.mjs
import 'dotenv/config';
import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGO_URI);
const { default: Subscription } = await import('../src/models/Subscription.js');
const { default: Project } = await import('../src/models/Project.js');

// Raw collection access so we can see legacy fields regardless of the schema
const col = mongoose.connection.db.collection('subscriptions');
const legacy = await col.find({ owner: { $exists: true } }).toArray();
console.log(`Found ${legacy.length} legacy owner-keyed subscription(s).`);

let created = 0;
for (const sub of legacy) {
  const projects = await Project.find({ owner: sub.owner }).select('_id info.title').lean();
  for (const p of projects) {
    const exists = await col.findOne({ project: p._id });
    if (exists) {
      console.log(`  skip ${p._id} ("${p.info?.title}") — already has a subscription`);
      continue;
    }
    await col.insertOne({
      project: p._id,
      plan: sub.plan,
      status: sub.status,
      startedAt: sub.startedAt,
      expiresAt: sub.expiresAt,
      history: sub.history || [],
      createdAt: sub.createdAt || new Date(),
      updatedAt: new Date(),
    });
    created++;
    console.log(`  copied ${sub.plan} sub → project ${p._id} ("${p.info?.title}")`);
  }
  if (projects.length === 0)
    console.log(`  owner ${sub.owner} has no assigned tours — legacy sub dropped`);
  await col.deleteOne({ _id: sub._id });
}

await Subscription.syncIndexes(); // drop owner_1, ensure project_1 unique
console.log(`Done: ${created} project subscription(s) created, ${legacy.length} legacy doc(s) removed, indexes synced.`);
await mongoose.disconnect();
