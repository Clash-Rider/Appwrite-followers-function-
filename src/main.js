import { Client, Users, Databases, Query } from 'node-appwrite';

<<<<<<< HEAD
export default async function main({ req, res, context }) {
=======
export default async function main({ req, res }) {
>>>>>>> dac06bc7585c836138ff00f542aec877d2804bef
  context.log(req);

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');

  const users = new Users(client);
  const databases = new Databases(client);

  const DATABASE_ID = process.env.DATABASE_ID;
  const FOLLOWS_COLLECTION_ID = process.env.FOLLOWS_COLLECTION_ID;
  const STATS_COLLECTION_ID = process.env.STATS_COLLECTION_ID;

  try {
    const rawBody = req.body;
    let body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    const { followeeId } = body;  // Only extract followeeId from the body

    // Extract the user ID from the headers
    const followerId = req.headers['x-appwrite-user-id'];
    context.log(`User ID: ${followerId}`);

    if (!followerId || !followeeId) {
      return res.json({ success: false, error: 'Missing user IDs' });
    }

    const existingFollow = await databases.listDocuments(DATABASE_ID, FOLLOWS_COLLECTION_ID, [
      Query.equal('followerId', followerId),
      Query.equal('followeeId', followeeId),
    ]);

    if (existingFollow.total > 0) {
      context.log('Follow exists, deleting...');
      for (const doc of existingFollow.documents) {
        await databases.deleteDocument(DATABASE_ID, FOLLOWS_COLLECTION_ID, doc.$id);
      }
    } else {
      context.log('No follow found, creating new follow...');
      await databases.createDocument(DATABASE_ID, FOLLOWS_COLLECTION_ID, 'unique()', {
        followerId,
        followeeId,
      });
    }

    const followersList = await databases.listDocuments(DATABASE_ID, FOLLOWS_COLLECTION_ID, [
      Query.equal('followeeId', followeeId),
    ]);
    const followingList = await databases.listDocuments(DATABASE_ID, FOLLOWS_COLLECTION_ID, [
      Query.equal('followerId', followerId),
    ]);

    const followersCount = followersList.total;
    const followingCount = followingList.total;

    const updateOrCreate = async (id, field, value) => {
      try {
        await databases.updateDocument(DATABASE_ID, STATS_COLLECTION_ID, id, {
          [field]: value,
        });
      } catch (e) {
        if (e.message.includes('Document with the requested ID could not be found')) {
          await databases.createDocument(DATABASE_ID, STATS_COLLECTION_ID, id, {
            followersCount: 0,
            followingCount: 0,
            [field]: value,
          });
        } else {
          throw e;
        }
      }
    };

    await updateOrCreate(followeeId, 'followersCount', followersCount);
    await updateOrCreate(followerId, 'followingCount', followingCount);

    return res.json({
      success: true,
      updated: {
        [followeeId]: { followersCount },
        [followerId]: { followingCount },
      },
    });
  } catch (err) {
    context.error(err);
    return res.json({ success: false, error: err.message });
  }
}
