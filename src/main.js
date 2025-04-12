import { Client, Users, Databases, Query } from 'node-appwrite';

export default async ({ req, res }) => {
  console.log('Function execution started',req);

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

  console.log('Environment variables loaded');
  console.log('DATABASE_ID:', DATABASE_ID);
  console.log('FOLLOWS_COLLECTION_ID:', FOLLOWS_COLLECTION_ID);
  console.log('STATS_COLLECTION_ID:', STATS_COLLECTION_ID);

  try {
    const contentType = req.headers['content-type'] || req.headers['Content-Type'];
    console.log('Content-Type:', contentType);

    let body;

    if (contentType === 'application/json') {
      console.log('Parsing JSON directly');
      body = req.body;
    } else if (typeof req.body === 'string') {
      console.log('Attempting to parse stringified body');
      try {
        body = JSON.parse(req.body);
      } catch (err) {
        console.log('JSON parse error:', err.message);
        return res.json({ success: false, error: 'Invalid JSON in request body' });
      }
    } else {
      console.log('Unsupported content type');
      return res.json({ success: false, error: 'Unsupported content type' });
    }

    console.log('Parsed body:', body);

    const { followerId, followeeId } = body;
    console.log('followerId:', followerId);
    console.log('followeeId:', followeeId);

    if (!followerId || !followeeId) {
      console.log('Missing user IDs');
      return res.json({ success: false, error: 'Missing user IDs' });
    }

    console.log('Fetching followers list...');
    const followersList = await databases.listDocuments(DATABASE_ID, FOLLOWS_COLLECTION_ID, [
      Query.equal('followeeId', followeeId),
    ]);
    console.log('Followers list fetched');

    console.log('Fetching following list...');
    const followingList = await databases.listDocuments(DATABASE_ID, FOLLOWS_COLLECTION_ID, [
      Query.equal('followerId', followerId),
    ]);
    console.log('Following list fetched');

    const followersCount = followersList.total;
    const followingCount = followingList.total;
    console.log('followersCount:', followersCount);
    console.log('followingCount:', followingCount);

    console.log('Updating followee stats...');
    await databases.updateDocument(DATABASE_ID, STATS_COLLECTION_ID, followeeId, {
      followersCount,
    });
    console.log('Followee stats updated');

    console.log('Updating follower stats...');
    await databases.updateDocument(DATABASE_ID, STATS_COLLECTION_ID, followerId, {
      followingCount,
    });
    console.log('Follower stats updated');

    return res.json({
      success: true,
      updated: {
        [followeeId]: { followersCount },
        [followerId]: { followingCount },
      },
    });
  } catch (err) {
    console.log('Error caught in catch block:', err.message);
    return res.json({ success: false, error: err.message });
  }
};
