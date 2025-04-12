import { Client, Users, Databases, Query } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
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
    const { followerId, followeeId } = JSON.parse(req.body);

    if (!followerId || !followeeId) {
      return res.json({ success: false, error: "Missing user IDs" });
    }

    const followersList = await databases.listDocuments(DATABASE_ID, FOLLOWS_COLLECTION_ID, [
      Query.equal("followeeId", followeeId),
    ]);

    const followingList = await databases.listDocuments(DATABASE_ID, FOLLOWS_COLLECTION_ID, [
      Query.equal("followerId", followerId),
    ]);

    const followersCount = followersList.total;
    const followingCount = followingList.total;

    await databases.updateDocument(DATABASE_ID, STATS_COLLECTION_ID, followeeId, {
      followersCount,
    });

    await databases.updateDocument(DATABASE_ID, STATS_COLLECTION_ID, followerId, {
      followingCount,
    });

    return res.json({
      success: true,
      updated: {
        [followeeId]: { followersCount },
        [followerId]: { followingCount },
      },
    });
  } catch (err) {
    log("Error: " + err.message);
    return res.json({ success: false, error: err.message });
  }
};
