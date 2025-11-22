import { getDb } from './dist/config/db.js';
import { generatePlaceholderSvgDataUrl } from './dist/utils/image-utils.js';

async function updateResourceIcons() {
  try {
    const db = await getDb();
    const resources = await db.collection('resources').find({
      type: { $ne: 'site' }
    }).toArray();

    console.log(`Found ${resources.length} resources to check`);

    let updated = 0;
    for (const resource of resources) {
      const newIcon = generatePlaceholderSvgDataUrl(resource.title, resource.format);
      await db.collection('resources').updateOne(
        { _id: resource._id },
        { $set: { image_url: newIcon } }
      );
      console.log(`Updated ${resource._id}: ${resource.title} (${resource.format})`);
      updated++;
    }

    console.log(`Done! Updated ${updated} resources.`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

updateResourceIcons();
