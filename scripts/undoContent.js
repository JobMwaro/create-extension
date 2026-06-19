if (globalThis.__CREATE_RECORDER__ && typeof globalThis.__CREATE_RECORDER__.stopRecording === 'function') {
  globalThis.__CREATE_RECORDER__.stopRecording();
} else {
  document.querySelectorAll('.create-ext-ribbon, .create-ext-stop, .create-ext-warning, .create-ext-flash')
    .forEach(el => el.remove());
}
