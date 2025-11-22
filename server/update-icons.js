import { getDb } from "./src/config/db.js";
import { generatePlaceholderSvgDataUrl } from "./src/utils/image-utils.js";

async function updateResourceIcons() {
  const db = await getDb();
  const resources = await db
    .collection("resources")
    .find({
      $or: [
        { image_url: { $exists: false } },
        { image_url: null },
        { image_url: "" },
      ],
    })
    .toArray();

  console.log(`Found ${resources.length} resources without icons`);

  for (const resource of resources) {
    const image_url = generatePlaceholderSvgDataUrl(
      resource.title,
      resource.format,
    );
    await db
      .collection("resources")
      .updateOne({ _id: resource._id }, { $set: { image_url } });
    console.log(
      `Updated ${resource._id}: ${resource.title} (${resource.format})`,
    );
  }

  console.log("Done!");
  process.exit(0);
}

updateResourceIcons().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
