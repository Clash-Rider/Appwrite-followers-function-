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
      console.log('Missing user IDs');
      return res.json({ success: false, error: 'Missing user IDs' });
    }

    console.log('Checking if follow relationship exists');
    const existingFollow = await databases.listDocuments(DATABASE_ID, FOLLOWS_COLLECTION_ID, [
      Query.equal('followerId', followerId),
      Query.equal('followeeId', followeeId),
    ]);

    if (existingFollow.total === 0) {
      console.log('No follow relationship found, creating one');
      await databases.createDocument(DATABASE_ID, FOLLOWS_COLLECTION_ID, 'unique()', {
        followerId,
        followeeId,
      });
    } else {
      console.log('Follow relationship already exists');
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

    const updateOrCreate = async (userId, field, value) => {
      try {
        await databases.updateDocument(DATABASE_ID, STATS_COLLECTION_ID, userId, {
          [field]: value,
        });
        console.log(`Updated ${field} for ${userId}`);
      } catch (e) {
        if (e.message.includes('Document with the requested ID could not be found')) {
          console.log(`Creating new stats document for ${userId}`);
          await databases.createDocument(DATABASE_ID, STATS_COLLECTION_ID, userId, {
            followersCount: 0,
            followingCount: 0,
            [field]: value,
          });
          console.log(`Created and initialized stats for ${userId}`);
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
    console.log('Error in catch block:', err.message);
    return res.json({ success: false, error: err.message });
  }
}
