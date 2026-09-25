(function () {
  "use strict";

  document.body.classList.add("js");

  const scenes = Array.from(document.querySelectorAll(".scene"));
  const totalScenes = scenes.length;
  const storyProgress = document.getElementById("story-progress");
  const sceneCounter = document.getElementById("scene-counter");
  const sceneAnnouncer = document.getElementById("scene-announcer");
  const previousButton = document.getElementById("previous-button");
  const nextButton = document.getElementById("next-button");
  const restartButton = document.getElementById("restart-button");
  const soundtrack = document.getElementById("soundtrack");
  const muteButton = document.getElementById("mute-button");
  const volumeControl = document.getElementById("volume-control");
  const audioStatus = document.getElementById("audio-status");
  const audioStatusText = document.getElementById("audio-status-text");

  let currentScene = 0;
  let currentStep = 0;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerStartedOnControl = false;
  let activeSoundtrackSrc = "./assets/bass-persuades.mp3";
  let soundtrackHasStarted = false;
  let soundtrackStartPending = false;
  let soundtrackRequestId = 0;
  const soundtrackTracks = [
    { src: "./assets/bass-persuades.mp3", cue: 28 },
    { src: "./assets/little-things-gypsy-woman.mp3", cue: 15 },
    { src: "./assets/last-train-home.mp3", cue: 52 },
    { src: "./assets/we-are-the-people.mp3", cue: 0 }
  ];
  const soundtrackPreloads = [];

  soundtrack.volume = Number(volumeControl.value) / 100;

  function setAudioStatus(state) {
    if (state === "ready") {
      audioStatus.hidden = true;
      audioStatus.classList.remove("is-error");
      audioStatusText.textContent = "";
      return;
    }
    audioStatus.hidden = false;
    audioStatus.classList.toggle("is-error", state === "error");
    audioStatusText.textContent = state === "error"
      ? "Não foi possível carregar a música."
      : "Carregando música.";
  }

  function preloadSoundtracks() {
    soundtrackTracks.forEach((track) => {
      const preload = new Audio();
      preload.preload = "auto";
      preload.src = track.src;
      preload.load();
      soundtrackPreloads.push(preload);
    });
  }

  function updateAudioControls() {
    const isMuted = soundtrack.muted || soundtrack.volume === 0;
    muteButton.setAttribute("aria-pressed", String(isMuted));
    muteButton.setAttribute("aria-label", isMuted ? "Desmutar música" : "Mutar música");
    muteButton.classList.toggle("is-muted", isMuted);
    volumeControl.setAttribute("aria-valuetext", `${Math.round(soundtrack.volume * 100)} por cento`);
  }

  function playFrom(time) {
    const requestId = ++soundtrackRequestId;
    soundtrackStartPending = true;
    setAudioStatus("loading");
    const beginPlayback = () => {
      if (requestId !== soundtrackRequestId) return;
      soundtrackStartPending = false;
      const playAttempt = soundtrack.play();
      soundtrackHasStarted = true;
      if (playAttempt) {
        playAttempt
          .then(() => setAudioStatus("ready"))
          .catch(() => {
            if (requestId !== soundtrackRequestId) return;
            soundtrackHasStarted = false;
            soundtrackStartPending = false;
            setAudioStatus("error");
          });
      }
    };

    const seekAndPlay = (attempt) => {
      if (requestId !== soundtrackRequestId) return;
      const safeTime = Number.isFinite(soundtrack.duration)
        ? Math.min(time, Math.max(0, soundtrack.duration - 0.1))
        : time;

      const confirmSeek = () => {
        if (requestId !== soundtrackRequestId) return;
        if (Math.abs(soundtrack.currentTime - safeTime) < 0.5) {
          beginPlayback();
          return;
        }
        if (attempt < 40) {
          window.setTimeout(() => seekAndPlay(attempt + 1), 125);
          return;
        }
        soundtrackStartPending = false;
        soundtrackHasStarted = false;
        setAudioStatus("error");
      };

      const handleSeeked = () => confirmSeek();
      soundtrack.addEventListener("seeked", handleSeeked, { once: true });
      soundtrack.currentTime = safeTime;
      if (!soundtrack.seeking && Math.abs(soundtrack.currentTime - safeTime) < 0.25) {
        soundtrack.removeEventListener("seeked", handleSeeked);
        beginPlayback();
      } else if (!soundtrack.seeking) {
        soundtrack.removeEventListener("seeked", handleSeeked);
        confirmSeek();
      }
    };

    if (soundtrack.readyState >= 1) seekAndPlay(0);
    else soundtrack.addEventListener("loadedmetadata", () => seekAndPlay(0), { once: true });
  }

  function getSoundtrackForCurrentScene() {
    if (currentScene < 3) return soundtrackTracks[0];
    if (currentScene < 6) return soundtrackTracks[1];
    if (currentScene < 8) return soundtrackTracks[2];
    return soundtrackTracks[3];
  }

  function syncSoundtrackForCurrentScene() {
    const track = getSoundtrackForCurrentScene();
    const changedTrack = activeSoundtrackSrc !== track.src;
    if (changedTrack) {
      activeSoundtrackSrc = track.src;
      soundtrack.src = track.src;
      soundtrack.load();
      soundtrackHasStarted = false;
      soundtrackStartPending = false;
    }
    if (changedTrack || (!soundtrackHasStarted && !soundtrackStartPending)) playFrom(track.cue);
  }

  function pad(number) {
    return String(number).padStart(2, "0");
  }

  function getReveals(sceneIndex) {
    return Array.from(scenes[sceneIndex].querySelectorAll("[data-step]"))
      .sort((a, b) => Number(a.dataset.step) - Number(b.dataset.step));
  }

  function createStoryBars() {
    storyProgress.innerHTML = "";
    scenes.forEach((scene, index) => {
      const segment = document.createElement("span");
      segment.className = "story-segment";
      segment.setAttribute("aria-hidden", "true");
      segment.dataset.scene = String(index);
      storyProgress.appendChild(segment);
    });
  }

  function setRevealState(sceneIndex, step) {
    const reveals = getReveals(sceneIndex);
    reveals.forEach((element, index) => {
      const visible = index < step;
      element.classList.toggle("is-revealed", visible);
      element.setAttribute("aria-hidden", String(!visible));
    });
    currentStep = Math.max(0, Math.min(step, reveals.length));
  }

  function updateStoryBars() {
    const segments = storyProgress.querySelectorAll(".story-segment");
    segments.forEach((segment, index) => {
      segment.classList.toggle("is-complete", index < currentScene);
      segment.classList.toggle("is-current", index === currentScene);
    });
    storyProgress.setAttribute("aria-label", `Progresso: cena ${currentScene + 1} de ${totalScenes}`);
  }

  function updateProgress() {
    sceneCounter.textContent = `${pad(currentScene + 1)} / ${pad(totalScenes)}`;
    previousButton.disabled = currentScene === 0 && currentStep === 0;
    nextButton.disabled = currentScene === totalScenes - 1 && currentStep === getReveals(currentScene).length;
    updateStoryBars();
  }

  function announceScene(includeStep) {
    const scene = scenes[currentScene];
    let message = `Tela ${currentScene + 1} de ${totalScenes}. ${scene.dataset.announcement}`;
    if (includeStep && currentStep > 0) {
      const revealed = getReveals(currentScene)[currentStep - 1];
      if (revealed) message += ` Revelado: ${revealed.textContent.trim().replace(/\s+/g, " ")}`;
    }
    sceneAnnouncer.textContent = "";
    window.setTimeout(() => { sceneAnnouncer.textContent = message; }, 30);
  }

  function showScene(index, options) {
    const settings = Object.assign({ revealAll: false, announce: true }, options);
    currentScene = Math.max(0, Math.min(index, totalScenes - 1));

    scenes.forEach((scene, sceneIndex) => {
      const active = sceneIndex === currentScene;
      scene.hidden = !active;
      scene.classList.toggle("is-active", active);
      scene.setAttribute("aria-hidden", String(!active));
    });

    const reveals = getReveals(currentScene);
    setRevealState(currentScene, settings.revealAll ? reveals.length : 0);
    updateProgress();
    if (settings.announce) announceScene(false);
  }

  function revealNextStep() {
    const reveals = getReveals(currentScene);
    if (currentStep >= reveals.length) return false;
    setRevealState(currentScene, currentStep + 1);
    updateProgress();
    announceScene(true);
    return true;
  }

  function hidePreviousStep() {
    if (currentStep <= 0) return false;
    setRevealState(currentScene, currentStep - 1);
    updateProgress();
    announceScene(false);
    return true;
  }

  function nextScene() {
    if (currentScene < totalScenes - 1) showScene(currentScene + 1);
  }

  function previousScene() {
    if (currentScene > 0) showScene(currentScene - 1, { revealAll: true });
  }

  function next() {
    if (!revealNextStep()) nextScene();
    syncSoundtrackForCurrentScene();
  }

  function previous() {
    if (!hidePreviousStep()) previousScene();
    syncSoundtrackForCurrentScene();
  }

  function restartPresentation() {
    scenes.forEach((scene, index) => setRevealState(index, 0));
    showScene(0);
    syncSoundtrackForCurrentScene();
  }

  function isInteractive(element) {
    return Boolean(element.closest("button, a, input, textarea, select, label, [role='button']"));
  }

  function handleKeyboardNavigation(event) {
    const interactive = isInteractive(event.target);

    if (interactive) return;

    if (event.key === "ArrowRight" || event.key === " ") {
      event.preventDefault();
      next();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      previous();
    } else if (event.key === "Home") {
      event.preventDefault();
      showScene(0);
      syncSoundtrackForCurrentScene();
    } else if (event.key === "End") {
      event.preventDefault();
      showScene(totalScenes - 1, { revealAll: true });
      syncSoundtrackForCurrentScene();
    }
  }

  function handlePointerStart(event) {
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    pointerStartedOnControl = isInteractive(event.target);
  }

  function handlePointerEnd(event) {
    if (pointerStartedOnControl) return;
    const deltaX = event.clientX - pointerStartX;
    const deltaY = event.clientY - pointerStartY;
    const moved = Math.hypot(deltaX, deltaY);

    if (moved > 12) {
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) next();
        else previous();
      }
      return;
    }

    if (event.clientX <= window.innerWidth * 0.24) previous();
    else next();
  }

  previousButton.addEventListener("click", previous);
  nextButton.addEventListener("click", next);
  restartButton.addEventListener("click", restartPresentation);
  muteButton.addEventListener("click", () => {
    soundtrack.muted = !soundtrack.muted;
    if (!soundtrack.muted && soundtrack.paused) syncSoundtrackForCurrentScene();
    updateAudioControls();
  });
  volumeControl.addEventListener("input", () => {
    soundtrack.volume = Number(volumeControl.value) / 100;
    if (soundtrack.volume > 0) soundtrack.muted = false;
    updateAudioControls();
  });
  soundtrack.addEventListener("ended", () => playFrom(0));
  soundtrack.addEventListener("waiting", () => setAudioStatus("loading"));
  soundtrack.addEventListener("playing", () => setAudioStatus("ready"));
  soundtrack.addEventListener("canplay", () => {
    if (!soundtrackStartPending) setAudioStatus("ready");
  });
  soundtrack.addEventListener("error", () => {
    soundtrackStartPending = false;
    soundtrackHasStarted = false;
    setAudioStatus("error");
  });
  document.addEventListener("keydown", handleKeyboardNavigation);
  document.addEventListener("pointerdown", handlePointerStart, { passive: true });
  document.addEventListener("pointerup", handlePointerEnd, { passive: true });
  createStoryBars();
  preloadSoundtracks();
  updateAudioControls();
  showScene(0, { announce: false });

  if ("serviceWorker" in navigator && /^https?:$/.test(window.location.protocol)) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js?v=2").catch(() => {});
    });
  }
})();
