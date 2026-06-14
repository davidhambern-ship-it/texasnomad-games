import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, List, Play, Settings, Music, Edit2, Trash2, Check } from 'lucide-react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const HEADING = { fontFamily: "'Teko', sans-serif" };

export default function HostPanel({ gs, updateState }) {
  const [playlists, setPlaylists] = useState([]);
  const [categories, setCategories] = useState([]);
  const [importUrl, setImportUrl] = useState('');
  const [importCategory, setImportCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPlaylists, setSelectedPlaylists] = useState(gs.selectedPlaylists || []);
  const [selectedCategories, setSelectedCategories] = useState(gs.selectedCategories || []);
  const [viewingSongs, setViewingSongs] = useState(null);
  const [editingSong, setEditingSong] = useState(null);
  const [editData, setEditData] = useState({ title: '', artist: '' });

  useEffect(() => {
    loadPlaylists();
    loadCategories();
  }, []);

  const loadPlaylists = async () => {
    const res = await base44.functions.invoke('nameThatTrack', { action: 'getPlaylists' });
    setPlaylists(res.data.playlists || []);
  };

  const loadCategories = async () => {
    const res = await base44.functions.invoke('nameThatTrack', { action: 'getCategories' });
    setCategories(res.data.categories || []);
  };

  const handleImport = async () => {
    if (!importUrl.trim()) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('nameThatTrack', {
        action: 'importPlaylist',
        playlistUrl: importUrl,
        categoryName: importCategory || null,
      });
      alert(`✅ Imported ${res.data.imported} songs (${res.data.duplicates} duplicates)`);
      setImportUrl('');
      setImportCategory('');
      loadPlaylists();
      loadCategories();
    } catch (err) {
      alert('❌ ' + err.message);
    }
    setLoading(false);
  };

  const handleViewSongs = async (playlistId) => {
    const res = await base44.functions.invoke('nameThatTrack', { action: 'getPlaylistSongs', playlistId });
    setViewingSongs({ playlistId, songs: res.data.songs || [] });
  };

  const handleEditSong = (song) => {
    setEditingSong(song.id);
    setEditData({ title: song.title, artist: song.artist });
  };

  const handleSaveEdit = async () => {
    await base44.functions.invoke('nameThatTrack', {
      action: 'updateSong',
      songId: editingSong,
      title: editData.title,
      artist: editData.artist,
    });
    setEditingSong(null);
    if (viewingSongs) handleViewSongs(viewingSongs.playlistId);
  };

  const handleDeleteSong = async (songId) => {
    if (!confirm('Delete this song?')) return;
    await base44.functions.invoke('nameThatTrack', { action: 'deleteSong', songId });
    if (viewingSongs) handleViewSongs(viewingSongs.playlistId);
    else loadPlaylists();
  };

  const handleStartGame = async () => {
    if (selectedPlaylists.length === 0 && selectedCategories.length === 0) {
      alert('Select at least one playlist or category');
      return;
    }
    await updateState({ selectedPlaylists, selectedCategories, phase: 'waiting', display_mode: 'game' });
  };

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="font-heading text-3xl md:text-4xl tracking-widest text-[#FFD700] uppercase" style={{ ...PS2, textShadow: '0 0 30px rgba(255,215,0,0.5)' }}>🎵 NAME THAT TRACK</div>
          <div className="text-white/40 text-sm mt-2" style={PS2}>HOST PANEL</div>
        </div>

        {/* Import */}
        <div className="p-5 rounded-2xl border border-[#BC13FE]/30 bg-[#BC13FE]/5">
          <div className="font-heading text-lg text-[#BC13FE] uppercase mb-4 flex items-center gap-2" style={PS2}><Plus className="w-5 h-5" /> Import Playlist</div>
          <div className="space-y-3">
            <input type="text" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="YouTube playlist URL" className="w-full px-4 py-3 bg-black/50 border border-[#BC13FE]/30 rounded-lg text-white placeholder-white/30 focus:border-[#BC13FE] focus:outline-none" />
            <input type="text" value={importCategory} onChange={(e) => setImportCategory(e.target.value)} placeholder="Category (optional)" className="w-full px-4 py-3 bg-black/50 border border-[#BC13FE]/30 rounded-lg text-white placeholder-white/30 focus:border-[#BC13FE] focus:outline-none" />
            <button onClick={handleImport} disabled={loading || !importUrl.trim()} className="w-full py-3 bg-[#BC13FE] text-white rounded-lg font-heading text-sm tracking-widest uppercase hover:bg-[#BC13FE]/90 disabled:opacity-50" style={PS2}>{loading ? 'IMPORTING...' : 'IMPORT PLAYLIST'}</button>
          </div>
        </div>

        {/* Selection */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Playlists */}
          <div className="p-5 rounded-2xl border border-[#FF5F1F]/30 bg-[#FF5F1F]/5">
            <div className="font-heading text-lg text-[#FF5F1F] uppercase mb-4 flex items-center gap-2" style={PS2}><List className="w-5 h-5" /> Select Playlists</div>
            {playlists.length === 0 ? <div className="text-white/30 text-sm text-center py-8">No playlists yet</div> : (
              <div className="space-y-2 max-h-80 overflow-auto">
                {playlists.map(p => (
                  <label key={p.id} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer ${selectedPlaylists.includes(p.id) ? 'border-[#FF5F1F] bg-[#FF5F1F]/20' : 'border-white/10 bg-white/5'}`}>
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={selectedPlaylists.includes(p.id)} onChange={() => setSelectedPlaylists(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])} className="w-4 h-4" />
                      <div>
                        <div className="font-heading text-white" style={HEADING}>{p.playlistName}</div>
                        <div className="text-[9px] text-white/40 uppercase" style={PS2}>{p.category} • {p.songCount} songs</div>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleViewSongs(p.id); }} className="p-2 hover:bg-white/10 rounded"><Music className="w-4 h-4 text-white/60" /></button>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Categories */}
          <div className="p-5 rounded-2xl border border-[#FFD700]/30 bg-[#FFD700]/5">
            <div className="font-heading text-lg text-[#FFD700] uppercase mb-4 flex items-center gap-2" style={PS2}><Settings className="w-5 h-5" /> Select Categories</div>
            {categories.length === 0 ? <div className="text-white/30 text-sm text-center py-8">No categories</div> : (
              <div className="space-y-2 max-h-80 overflow-auto">
                {categories.map(c => (
                  <label key={c} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${selectedCategories.includes(c) ? 'border-[#FFD700] bg-[#FFD700]/20' : 'border-white/10 bg-white/5'}`}>
                    <input type="checkbox" checked={selectedCategories.includes(c)} onChange={() => setSelectedCategories(prev => prev.includes(c) ? prev.filter(cat => cat !== c) : [...prev, c])} className="w-4 h-4" />
                    <span className="font-heading text-white" style={HEADING}>{c}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Songs View */}
        {viewingSongs && (
          <div className="p-5 rounded-2xl border border-white/20 bg-white/5">
            <div className="flex items-center justify-between mb-4">
              <div className="font-heading text-lg text-white uppercase" style={PS2}>📋 Songs ({viewingSongs.songs.length})</div>
              <button onClick={() => setViewingSongs(null)} className="text-white/40 hover:text-white text-sm">✕ CLOSE</button>
            </div>
            <div className="space-y-2 max-h-96 overflow-auto">
              {viewingSongs.songs.map(song => (
                <div key={song.id} className="flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-black/30">
                  <img src={song.thumbnail} alt="" className="w-12 h-12 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    {editingSong === song.id ? (
                      <div className="space-y-1">
                        <input value={editData.title} onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))} className="w-full px-2 py-1 bg-black/50 border border-white/20 rounded text-white text-xs" />
                        <input value={editData.artist} onChange={(e) => setEditData(prev => ({ ...prev, artist: e.target.value }))} className="w-full px-2 py-1 bg-black/50 border border-white/20 rounded text-white text-xs" />
                      </div>
                    ) : (
                      <>
                        <div className="font-heading text-white truncate" style={HEADING}>{song.title}</div>
                        <div className="text-[9px] text-white/40 truncate" style={PS2}>{song.artist}</div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editingSong === song.id ? (
                      <button onClick={handleSaveEdit} className="p-2 bg-[#4ade80]/20 border border-[#4ade80]/50 rounded text-[#4ade80]"><Check className="w-4 h-4" /></button>
                    ) : (
                      <button onClick={() => handleEditSong(song)} className="p-2 hover:bg-white/10 rounded"><Edit2 className="w-4 h-4 text-white/60" /></button>
                    )}
                    <button onClick={() => handleDeleteSong(song.id)} className="p-2 hover:bg-red-500/20 rounded text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Start Button */}
        {(selectedPlaylists.length > 0 || selectedCategories.length > 0) && (
          <button onClick={handleStartGame} className="fixed bottom-6 right-6 px-8 py-4 bg-gradient-to-r from-[#FFD700] to-[#FF5F1F] text-black rounded-xl font-heading text-lg tracking-widest uppercase hover:opacity-90 shadow-lg" style={{ ...PS2, boxShadow: '0 0 30px rgba(255,215,0,0.4)' }}><Play className="w-5 h-5 inline mr-2" />START GAME</button>
        )}
      </div>
    </div>
  );
}