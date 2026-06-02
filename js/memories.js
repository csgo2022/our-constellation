window.App = window.App || {};

(function() {
  'use strict';

  var rest = window.App.rest;

  async function fetchMemories(coupleId) {
    var result = await rest.select('memories', {
      select: '*',
      couple_id: coupleId,
      order: 'date.asc'
    });

    if (result.error) throw result.error;
    return result.data || [];
  }

  async function addMemory(coupleId, userId, memory) {
    var result = await rest.insert('memories', {
      couple_id: coupleId,
      created_by: userId,
      title: memory.title,
      story: memory.story,
      date: memory.date,
      image_url: memory.image_url || null,
      image_path: memory.image_path || null,
      x: memory.x,
      y: memory.y
    });

    if (result.error) throw result.error;
    return result.data[0];
  }

  async function updateMemory(memoryId, updates) {
    var body = {
      title: updates.title,
      story: updates.story,
      date: updates.date,
      updated_at: new Date().toISOString()
    };
    if (updates.image_url !== undefined) body.image_url = updates.image_url;
    if (updates.image_path !== undefined) body.image_path = updates.image_path;

    var result = await rest.update('memories', { id: 'eq.' + memoryId }, body);

    if (result.error) throw result.error;
    return result.data[0];
  }

  async function deleteMemory(memoryId, imagePath) {
    if (imagePath) {
      await rest.removeFile('memory-images', imagePath).catch(function(e) {});
    }

    var result = await rest.remove('memories', { id: 'eq.' + memoryId });

    if (result.error) throw result.error;
  }

  window.App.memories = {
    fetchMemories: fetchMemories,
    addMemory: addMemory,
    updateMemory: updateMemory,
    deleteMemory: deleteMemory
  };
})();
