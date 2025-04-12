import { Client, Users, Databases, Query } from 'node-appwrite';

export default async function main({ req, res }) {
  console.log('--- Function start ---');

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');

  console.log('Client initialized');

  const users = new Users(client);
  const databases = new Databases(client);

  const DATABASE_ID = process.env.DATABASE_ID;
  const FOLLOWS_COLLECTION_ID = process.env.FOLLOWS_COLLECTION_ID;
  const STATS_COLLECTION_ID = process.env.STATS_COLLECTION_ID;

  console.log('Loaded environment variables:', {
    DATABASE_ID,
    FOLLOWS_COLLECTION_ID,
    STATS_COLLECTION_ID,
  });

  try {
    const rawBody = req.body;
    console.log('Raw body received:', rawBody);

    let body;
    if (typeof rawBody === 'string') {
      try {
        body = JSON.parse(rawBody);
      } catch (err) {
        console.log('Failed to parse stringified JSON:', err.message);
        return res.json({ success: false, error: 'Invalid JSON format in request body' });
      }
    } else {
      body = rawBody;
    }

    console.log('Parsed body:', body);

    const { followerId, followeeId } = body;

    if (!followerId || !followeeId) {
      console.log('Missing required fields: followerId or followeeId');
      return res.json({ success: false, error: 'Missing user IDs' });
    }

    console.log('Fetching followers of', followeeId);
    const followersList = await databases.listDocuments(DATABASE_ID, FOLLOWS_COLLECTION_ID, [
      Query.equal('followeeId', followeeId),
    ]);

    console.log('Fetching followings of', followerId);
    const followingList = await databases.listDocuments(DATABASE_ID, FOLLOWS_COLLECTION_ID, [
      Query.equal('followerId', followerId),
    ]);

    const followersCount = followersList.total;
    const followingCount = followingList.total;

    console.log('Counts:', { followersCount, followingCount });

    await databases.updateDocument(DATABASE_ID, STATS_COLLECTION_ID, followeeId, {
      followersCount,
    });
    console.log(`Updated followersCount for ${followeeId}`);

    await databases.updateDocument(DATABASE_ID, STATS_COLLECTION_ID, followerId, {
      followingCount,
    });
    console.log(`Updated followingCount for ${followerId}`);

    return res.json({
      success: true,
      updated: {
        [followeeId]: { followersCount },
        [followerId]: { followingCount },
      },
    });
  } catch (err) {
    console.log('Error in catch block:', err.message);
    return res.json({ success: false, error: err.message });
  }
}
