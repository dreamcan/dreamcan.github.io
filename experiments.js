(function () {
  'use strict';
  var root = document.getElementById('experiments');
  if (!root) return;
  var base = 'assets/experiments/suite/';
  var manifest;
  var videos = Array.from(root.querySelectorAll('[data-exp-video]'));
  var visible = new WeakMap();
  var galleries = Array.from(root.querySelectorAll('[data-exp-gallery]'));

  function playVisible(video) {
    var canPlay = visible.get(video) && !video.closest('[hidden]') && !document.hidden;
    if (canPlay && video.dataset.expSrc) {
      if (video.getAttribute('src') !== video.dataset.expSrc) {
        video.src = video.dataset.expSrc;
        video.load();
      }
      video.play().catch(function () {});
    } else video.pause();
  }

  function syncVideos() { videos.forEach(playVisible); }

  Array.from(root.querySelectorAll('[data-exp-tabs]')).forEach(function (group) {
    var tabs = Array.from(group.querySelectorAll(':scope > [role="tab"]'));
    function select(index, focus) {
      tabs.forEach(function (button, i) {
        var active = i === index;
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
        document.getElementById(button.getAttribute('aria-controls')).hidden = !active;
      });
      if (focus) tabs[index].focus();
      syncVideos();
    }
    tabs.forEach(function (button, i) {
      button.addEventListener('click', function () { select(i, false); });
      button.addEventListener('keydown', function (event) {
        var next;
        if (event.key === 'ArrowRight') next = (i + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') next = (i + tabs.length - 1) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault();
        select(next, true);
      });
    });
    select(0, false);
  });

  var recipes = {
    search: [1,2,4].map(function (calls) {
      return {asset:'search-calls-'+calls,title:calls+' generator call'+(calls===1?'':'s'),meta:'Generated visual plan',caption:'Presentation slide 19 · original sequence and playback timing. Call count verified from the slide label and media object.'};
    }),
    language: [25,26,27].map(function (number) {
      return {asset:'language-table-steer-'+number,title:'Instruction-conditioned sparse plan',meta:'Language Table · generated subgoals',caption:'Presentation slide 20 · same initial observation, different language instruction.'};
    }),
    packing: [
      {asset:'packing-steer-left',instruction:'Bread down, blue cube top left, and the bear top right.'},
      {asset:'packing-steer-up',instruction:'Bread up, blue cube down left, and the bear down right.'},
      {asset:'packing-steer-right',instruction:'Bread down, bear top left, and the blue cube top right.'}
    ].map(function (item) {
      item.title='VLM-steered packing plan';item.meta='Generated visual plan';
      item.caption='Presentation slide 28 · shared object scene and task; added spatial preferences are given to the VLM scorer.';
      return item;
    }),
    policy: [
      {asset:'pusht-ours-trial0',title:'PushT · closed-loop execution',meta:'Simulation · execution + three generated subgoals',caption:'Left: actual PushT execution. Right: three generated DP subgoals consumed by the policy. This clip comes from a separately archived 84% run; the manuscript aggregate is 86%.'},
      {asset:'libero-stove',title:'LIBERO-Long · stove and moka pot',meta:'Simulation · execution + generated subgoals',caption:'Turn on the stove and put the moka pot on it. Left: simulator observation; right: the generated subgoal grid.'},
      {asset:'libero-microwave',title:'LIBERO-Long · mug and microwave',meta:'Simulation · execution + generated subgoals',caption:'Put the yellow and white mug in the microwave and close it. Left: simulator observation; right: the generated subgoal grid.'}
    ],
    real: [
      {asset:'real-folding',title:'Cardboard Box Folding',meta:'Real robot · 4× playback',heading:'Contact-rich manipulation',description:'Fold a randomly placed, unfolded cardboard box into its usable configuration.',training:'100 human teleoperation demonstrations',evaluation:'20 episodes with randomly placed cardboard boxes',challenge:'Precise contact and sequential folding',success:'40%',trials:'8 / 20',caption:'Recorded dual-arm robot execution · original presentation playback at 4×.'},
      {asset:'real-packing',title:'Box Packing',meta:'Real robot · 3× playback',heading:'Unseen object combinations',description:'Follow a language instruction to pack a specified set of objects into a box. The object pool has 2 big, 3 medium, and 6 small objects.',training:'550 demonstrations: 110 combinations × 5',evaluation:'20 episodes drawn from 95 held-out combinations',challenge:'Zero-shot compositional generalization across object sets',success:'65%',trials:'13 / 20',caption:'Recorded dual-arm robot execution · original presentation playback at 3×.'},
      {asset:'real-line',title:'Make a Line',meta:'Real robot · 4× playback',heading:'Multi-object, long-horizon manipulation',description:'Move six cubes into the instructed line arrangement. Training includes three target line shapes.',training:'90 demonstrations across three line shapes',evaluation:'20 episodes',challenge:'Arrange multiple objects over a long action sequence',success:'55%',trials:'11 / 20',caption:'Recorded dual-arm robot execution · vertical-line example · original presentation playback at 4×.'}
    ],
    regrasp: [{asset:'square-regrasp',title:'Square · episode 103',meta:'Source frame numbers retained',caption:'Original demonstration excerpt: anchor 101, drop 107, and near-anchor regrasp at 208.'}]
  };

  function showGallery(gallery, index) {
    if (!manifest) return;
    var recipe = recipes[gallery.dataset.expGallery][index];
    var asset = manifest.assets[recipe.asset];
    var video = gallery.querySelector('[data-exp-video]');
    var src = base + asset.video;
    video.pause();
    video.hidden = false;
    var error = gallery.querySelector('.exp-media-error');
    if (error) error.remove();
    if (video.getAttribute('src') !== src && video.hasAttribute('src')) {
      video.removeAttribute('src');video.load();
    }
    video.dataset.expSrc = src;
    video.poster = base + asset.poster;
    video.style.aspectRatio = asset.width + ' / ' + asset.height;
    video.muted = true;
    var fields = ['title','meta','caption','heading','description','training','evaluation','challenge','success','trials'];
    fields.forEach(function (field) {
      var target = gallery.querySelector('[data-exp-' + field + ']');
      if (target && recipe[field]) target.textContent = recipe[field];
    });
    var instruction = gallery.querySelector('[data-exp-instruction]');
    if (instruction) instruction.textContent = recipe.instruction || asset.instruction || '';
    var strip = gallery.querySelector('[data-exp-strip]');
    if (strip) strip.src = base + manifest.strips[recipe.strip].image;
    Array.from(gallery.querySelectorAll('[data-exp-choice]')).forEach(function (button, i) {
      button.setAttribute('aria-pressed', String(i === index));
    });
    gallery.setAttribute('aria-busy', 'false');
    playVisible(video);
  }

  galleries.forEach(function (gallery) {
    Array.from(gallery.querySelectorAll('[data-exp-choice]')).forEach(function (button) {
      button.addEventListener('click', function () { showGallery(gallery, Number(button.dataset.expChoice)); });
    });
  });

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      visible.set(entry.target, entry.isIntersecting);
      playVisible(entry.target);
    });
  }, {rootMargin:'100px'});
  videos.forEach(function (video) {
    visible.set(video, false);
    observer.observe(video);
    video.addEventListener('loadeddata', function () { playVisible(video); });
    video.addEventListener('play', function () {
      if (!visible.get(video) || video.closest('[hidden]') || document.hidden) video.pause();
    });
    video.addEventListener('error', function () {
      if (!video.error || !video.hasAttribute('src')) return;
      video.hidden = true;
      var error = document.createElement('div');
      error.className='exp-media-error';error.textContent=video.hasAttribute('data-exp-asset') ? 'Video could not be loaded. Please reload the page.' : 'Video could not be loaded. Choose another example or reload.';
      video.after(error);
    });
  });
  new MutationObserver(syncVideos).observe(root,{subtree:true,attributes:true,attributeFilter:['hidden','data-exp-src']});
  document.addEventListener('visibilitychange',syncVideos);

  function showReachTask(index) {
    if (!manifest || !document.getElementById('exp-reach-instruction')) return;
    var current = manifest.reachability.tasks[index];
    document.getElementById('exp-reach-instruction').textContent=current.instruction;
    document.getElementById('exp-reach-ours').textContent=(current.ours*100).toFixed(1)+'%';
    document.getElementById('exp-reach-uniform').textContent=(current.uniform*100).toFixed(1)+'%';
    Array.from(root.querySelectorAll('[data-exp-reach-task]')).forEach(function (button) {
      button.setAttribute('aria-pressed',String(Number(button.dataset.expReachTask)===index));
    });
  }
  Array.from(root.querySelectorAll('[data-exp-reach-task]')).forEach(function (button) {
    button.addEventListener('click',function () { showReachTask(Number(button.dataset.expReachTask)); });
  });

  fetch(base+'manifest.json', {cache:'no-cache'}).then(function (response) {
    if (!response.ok) throw new Error('Experiment assets unavailable');
    return response.json();
  }).then(function (data) {
    manifest=data;
    galleries.forEach(function (gallery) { showGallery(gallery,0); });
    showReachTask(0);
  }).catch(function () {
    galleries.forEach(function (gallery) {
      gallery.setAttribute('aria-busy','false');
      var caption=gallery.querySelector('[data-exp-caption]');
      if (caption) caption.textContent='Examples could not be loaded. Please reload the page.';
    });
  });
})();
