window.App = window.App || {};

(function() {
  'use strict';

  const { supabase } = window.App;

  async function fetchMemories(coupleId) {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('couple_id', coupleId)
      .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async function addMemory(coupleId, userId, memory) {
    const { data, error } = await supabase
      .from('memories')
      .insert({
        couple_id: coupleId,
        created_by: userId,
        title: memory.title,
        story: memory.story,
        date: memory.date,
        image_url: memory.image_url || null,
        image_path: memory.image_path || null,
        x: memory.x,
        y: memory.y
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function updateMemory(memoryId, updates) {
    const { data, error } = await supabase
      .from('memories')
      .update({
        title: updates.title,
        story: updates.story,
        date: updates.date,
        image_url: updates.image_url || undefined,
        image_path: updates.image_path || undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', memoryId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function deleteMemory(memoryId, imagePath) {
    if (imagePath) {
      await supabase.storage
        .from('memory-images')
        .remove([imagePath])
        .catch(function() {});
    }

    const { error } = await supabase
      .from('memories')
      .delete()
      .eq('id', memoryId);

    if (error) throw error;
  }

  window.App.memories = {
    fetchMemories: fetchMemories,
    addMemory: addMemory,
    updateMemory: updateMemory,
    deleteMemory: deleteMemory
  };
})();
