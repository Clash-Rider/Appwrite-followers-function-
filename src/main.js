import { Client, Users } from 'node-appwrite';

// This Appwrite function will be executed every time your function is triggered
export default async ({ req, res, log, error }) => {
  // You can use the Appwrite SDK to interact with other services
  // For this example, we're using the Users service
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');
  const users = new Users(client);

  const databases = new Databases(client);

  // Load all required env variables
  const DATABASE_ID = process.env.DATABASE_ID;
  const FOLLOWS_COLLECTION_ID = process.env.FOLLOWS_COLLECTION_ID;
  const STATS_COLLECTION_ID = process.env.STATS_COLLECTION_ID;

  try {
    // Parse input
    const { followerId, followeeId } = JSON.parse(req.body);

    if (!followerId || !followeeId) {
      return res.json({ success: false, error: "Missing user IDs" });
    }

    // Count how many users are following followeeId
    const followersList = await databases.listDocuments(DATABASE_ID, FOLLOWS_COLLECTION_ID, [
      Query.equal("followeeId", followeeId),
    ]);

    // Count how many users follow someone by followerId
    const followingList = await databases.listDocuments(DATABASE_ID, FOLLOWS_COLLECTION_ID, [
      Query.equal("followerId", followerId),
    ]);

    const followersCount = followersList.total;
    const followingCount = followingList.total;

    // Update followee's followers count
    await databases.updateDocument(DATABASE_ID, STATS_COLLECTION_ID, followeeId, {
      followersCount,
    });

    // Update follower's following count
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
};
