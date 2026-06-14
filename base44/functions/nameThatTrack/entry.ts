import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action } = await req.json();

    // Extract playlist ID from URL
    function extractPlaylistId(url) {
      if (!url) return null;
      if (url.startsWith('PL') || url.startsWith('UU') || url.startsWith('FL')) return url;
      const match = url.match(/[?&]list=([^&]+)/);
      return match ? match[1] : null;
    }

    // Import videos from a YouTube playlist
    if (action === 'importPlaylist') {
      const { playlistUrl, categoryName } = await req.json();
      if (!playlistUrl) return Response.json({ error: 'Playlist URL required' }, { status: 400 });

      const playlistId = extractPlaylistId(playlistUrl);
      if (!playlistId) return Response.json({ error: 'Invalid playlist URL' }, { status: 400 });

      // Get playlist details
      const playlistRes = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${YOUTUBE_API_KEY}`);
      const playlistData = await playlistRes.json();

      if (!playlistData.items || playlistData.items.length === 0) {
        return Response.json({ error: 'Playlist not found' }, { status: 404 });
      }

      const playlistInfo = playlistData.items[0];
      const category = categoryName || playlistInfo.snippet.title || 'Uncategorized';

      // Save or update playlist
      const existingPlaylist = await base44.entities.Playlist.filter({ playlistId });
      let playlist;
      if (existingPlaylist.length > 0) {
        playlist = await base44.entities.Playlist.update(existingPlaylist[0].id, {
          playlistName: playlistInfo.snippet.title,
          category,
          sourceUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
        });
      } else {
        playlist = await base44.entities.Playlist.create({
          playlistId,
          playlistName: playlistInfo.snippet.title,
          category,
          sourceUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
          created_by_user_id: user.id,
        });
      }

      // Get playlist items (up to 50)
      const itemsRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${YOUTUBE_API_KEY}`);
      const itemsData = await itemsRes.json();

      if (!itemsData.items) {
        return Response.json({ error: 'Failed to fetch playlist items', details: itemsData }, { status: 500 });
      }

      const videoIds = itemsData.items.map(item => item.snippet.resourceId.videoId).filter(Boolean);
      
      // Get video details
      const detailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoIds.join(',')}&key=${YOUTUBE_API_KEY}`);
      const detailsData = await detailsRes.json();

      const imported = [];
      const duplicates = [];
      const errors = [];

      for (const item of detailsData.items || []) {
        const videoId = item.id;
        const snippet = item.snippet;
        
        // Check for duplicates
        const existingSong = await base44.entities.Song.filter({ youtubeVideoId: videoId });
        if (existingSong.length > 0) {
          duplicates.push({ videoId, title: snippet.title });
          // Link to playlist if not already linked
          const existingLinks = await base44.entities.PlaylistSong.filter({ playlistId: playlist.id, songId: existingSong[0].id });
          if (existingLinks.length === 0) {
            await base44.entities.PlaylistSong.create({ playlistId: playlist.id, songId: existingSong[0].id });
          }
          continue;
        }

        try {
          // Create song
          const song = await base44.entities.Song.create({
            title: snippet.title,
            artist: snippet.channelTitle,
            youtubeVideoId: videoId,
            thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
            channelTitle: snippet.channelTitle,
            duration: item.contentDetails?.duration,
            originalTitle: snippet.title,
            originalArtist: snippet.channelTitle,
          });

          // Link to playlist
          await base44.entities.PlaylistSong.create({
            playlistId: playlist.id,
            songId: song.id,
            position: imported.length,
          });

          // Create game question
          await base44.entities.GameQuestion.create({
            songId: song.id,
            questionType: 'title',
            correctTitle: snippet.title,
            correctArtist: snippet.channelTitle,
            acceptableTitles: [],
            acceptableArtists: [],
            difficulty: 'medium',
            points: 100,
          });

          imported.push({ songId: song.id, videoId, title: snippet.title });
        } catch (err) {
          errors.push({ videoId, error: err.message });
        }
      }

      return Response.json({
        playlist,
        imported: imported.length,
        duplicates: duplicates.length,
        errors: errors.length,
        details: { imported, duplicates, errors },
      });
    }

    // Update song title/artist
    if (action === 'updateSong') {
      const { songId, title, artist } = await req.json();
      if (!songId) return Response.json({ error: 'Song ID required' }, { status: 400 });

      const updates = {};
      if (title !== undefined) updates.title = title;
      if (artist !== undefined) updates.artist = artist;

      const song = await base44.entities.Song.update(songId, updates);
      
      // Update associated game questions
      const questions = await base44.entities.GameQuestion.filter({ songId });
      for (const q of questions) {
        const qUpdates = {};
        if (title !== undefined) qUpdates.correctTitle = title;
        if (artist !== undefined) qUpdates.correctArtist = artist;
        await base44.entities.GameQuestion.update(q.id, qUpdates);
      }

      return Response.json({ song, questionsUpdated: questions.length });
    }

    // Get all playlists with song counts
    if (action === 'getPlaylists') {
      const playlists = await base44.entities.Playlist.filter({ active: true });
      const result = [];
      for (const playlist of playlists) {
        const links = await base44.entities.PlaylistSong.filter({ playlistId: playlist.id });
        result.push({
          ...playlist,
          songCount: links.length,
        });
      }
      return Response.json({ playlists: result });
    }

    // Get songs in a playlist
    if (action === 'getPlaylistSongs') {
      const { playlistId } = await req.json();
      if (!playlistId) return Response.json({ error: 'Playlist ID required' }, { status: 400 });

      const links = await base44.entities.PlaylistSong.filter({ playlistId }, 'position');
      const songs = [];
      for (const link of links) {
        const song = await base44.entities.Song.get(link.songId);
        if (song) songs.push({ ...song, linkId: link.id, position: link.position });
      }
      return Response.json({ songs });
    }

    // Get random question for gameplay
    if (action === 'getRandomQuestion') {
      const { selectedPlaylists, selectedCategories } = await req.json();
      
      let allQuestions = await base44.entities.GameQuestion.filter({ active: true });
      
      // Filter by selected playlists
      if (selectedPlaylists && selectedPlaylists.length > 0) {
        const playlistLinks = [];
        for (const pid of selectedPlaylists) {
          const links = await base44.entities.PlaylistSong.filter({ playlistId: pid });
          playlistLinks.push(...links);
        }
        const songIds = [...new Set(playlistLinks.map(l => l.songId))];
        allQuestions = allQuestions.filter(q => songIds.includes(q.songId));
      }
      
      // Filter by categories
      if (selectedCategories && selectedCategories.length > 0) {
        const playlistsWithCategory = await base44.entities.Playlist.filter({ 
          category: { $in: selectedCategories },
          active: true 
        });
        const playlistIds = playlistsWithCategory.map(p => p.id);
        const playlistLinks = [];
        for (const pid of playlistIds) {
          const links = await base44.entities.PlaylistSong.filter({ playlistId: pid });
          playlistLinks.push(...links);
        }
        const songIds = [...new Set(playlistLinks.map(l => l.songId))];
        allQuestions = allQuestions.filter(q => songIds.includes(q.songId));
      }

      if (allQuestions.length === 0) {
        return Response.json({ error: 'No questions available' }, { status: 404 });
      }

      const randomQuestion = allQuestions[Math.floor(Math.random() * allQuestions.length)];
      const song = await base44.entities.Song.get(randomQuestion.songId);
      
      return Response.json({
        question: randomQuestion,
        song,
      });
    }

    // Get all categories
    if (action === 'getCategories') {
      const playlists = await base44.entities.Playlist.filter({ active: true });
      const categories = [...new Set(playlists.map(p => p.category).filter(Boolean))];
      return Response.json({ categories });
    }

    // Delete song and associated data
    if (action === 'deleteSong') {
      const { songId } = await req.json();
      if (!songId) return Response.json({ error: 'Song ID required' }, { status: 400 });

      // Delete playlist links
      const links = await base44.entities.PlaylistSong.filter({ songId });
      for (const link of links) {
        await base44.entities.PlaylistSong.delete(link.id);
      }

      // Delete questions
      const questions = await base44.entities.GameQuestion.filter({ songId });
      for (const q of questions) {
        await base44.entities.GameQuestion.delete(q.id);
      }

      // Delete song
      await base44.entities.Song.delete(songId);

      return Response.json({ deleted: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});