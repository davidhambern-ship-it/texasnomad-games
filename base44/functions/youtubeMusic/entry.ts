import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    // Search YouTube for music videos
    if (action === 'search') {
      const { query, maxResults = 10 } = await req.json();
      if (!query) return Response.json({ error: 'Query required' }, { status: 400 });

      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=${maxResults}&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&key=${YOUTUBE_API_KEY}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();

      if (!searchData.items) return Response.json({ error: 'YouTube API error', details: searchData }, { status: 500 });

      const videoIds = searchData.items.map(item => item.id.videoId).join(',');
      const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
      const detailsRes = await fetch(detailsUrl);
      const detailsData = await detailsRes.json();

      const tracks = detailsData.items.map(item => ({
        youtube_id: item.id,
        title: item.snippet.title,
        artist: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
        duration: item.contentDetails?.duration,
        publishedAt: item.snippet.publishedAt,
      }));

      return Response.json({ tracks });
    }

    // Get video details by ID
    if (action === 'details') {
      const { videoId } = await req.json();
      if (!videoId) return Response.json({ error: 'Video ID required' }, { status: 400 });

      const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`;
      const res = await fetch(detailsUrl);
      const data = await res.json();

      if (!data.items || data.items.length === 0) {
        return Response.json({ error: 'Video not found' }, { status: 404 });
      }

      const item = data.items[0];
      return Response.json({
        youtube_id: item.id,
        title: item.snippet.title,
        artist: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails?.high?.url,
        duration: item.contentDetails?.duration,
        publishedAt: item.snippet.publishedAt,
      });
    }

    // Save track to database
    if (action === 'save') {
      const { youtube_id, title, artist, thumbnail, duration, category, game_id } = await req.json();
      if (!youtube_id || !title) return Response.json({ error: 'youtube_id and title required' }, { status: 400 });

      const track = await base44.entities.MusicTrack.create({
        youtube_id,
        title,
        artist: artist || null,
        thumbnail: thumbnail || null,
        duration: duration || null,
        category: category || null,
        game_id: game_id || null,
      });

      return Response.json({ track });
    }

    // Get saved tracks
    if (action === 'tracks') {
      const { game_id } = await req.json();
      const query = game_id ? { game_id, active: true } : { active: true };
      const tracks = await base44.entities.MusicTrack.filter(query);
      return Response.json({ tracks });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});