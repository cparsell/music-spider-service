// In-memory progress state for the event search (single-process, personal-use
// app, so a module-level variable is enough - no need for a job queue/DB).
let state = {
  running: false,
  phase: "",
  completed: 0,
  total: 0,
  cancelRequested: false,
  // Summary of the most recently completed search, so a client that wasn't
  // the one who made the request (e.g. it switched tabs mid-search and
  // came back) can still learn how it turned out.
  result: null,
};

export function setProgress(patch) {
  state = { ...state, ...patch };
}

export function getProgress() {
  return state;
}

export function requestCancel() {
  state = { ...state, cancelRequested: true };
}

export function isCancelRequested() {
  return state.cancelRequested;
}
