window.App = window.App || {};

(function() {
  'use strict';

  var rest = window.App.rest;

  function compressImage(file, maxWidth, quality) {
    maxWidth = maxWidth || 800;
    quality = quality || 0.8;
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = function(e) {
        var img = new Image();
        img.src = e.target.result;
        img.onload = function() {
          var canvas = document.createElement('canvas');
          var width = img.width;
          var height = img.height;

          if (width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(function(blob) {
            if (blob) resolve(blob);
            else reject(new Error('压缩失败'));
          }, 'image/jpeg', quality);
        };
        img.onerror = function() { reject(new Error('图片加载失败')); };
      };
      reader.onerror = function() { reject(new Error('文件读取失败')); };
    });
  }

  async function uploadImage(file, coupleId) {
    var compressed = await compressImage(file);

    var ext = file.name.split('.').pop() || 'jpg';
    var timestamp = Date.now();
    var random = Math.random().toString(36).substring(2, 8);
    var fileName = timestamp + '-' + random + '.' + ext;
    var filePath = coupleId + '/' + fileName;

    var result = await rest.upload('memory-images', filePath, compressed, 'image/jpeg');
    if (result.error) throw result.error;

    var url = rest.getPublicUrl('memory-images', filePath);
    return { url: url, path: filePath };
  }

  window.App.storage = {
    compressImage: compressImage,
    uploadImage: uploadImage
  };
})();
